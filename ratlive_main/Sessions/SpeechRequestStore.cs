namespace RatLiveMain.Sessions;

enum SpeechRequestState
{
    Pending,
    Paused,
    Active
}

sealed class SpeechRequestItem
{
    public int UserId { get; init; }
    public DateTime RequestedAt { get; set; }
    public SpeechRequestState State { get; set; }
}

sealed class SpeechQueueSnapshotItem
{
    public int UserId { get; init; }
    public DateTime RequestedAt { get; init; }
    public SpeechRequestState State { get; init; }
}

sealed class SpeechQueueSnapshot
{
    public int? ActiveUserId { get; init; }
    public long? ActiveContributionId { get; init; }
    public DateTime? ActiveSinceUtc { get; init; }
    public List<SpeechQueueSnapshotItem> Items { get; init; } = [];
}

sealed class ActiveContributionRef
{
    public int UserId { get; init; }
    public long ContributionId { get; init; }
    public DateTime StartedAtUtc { get; init; }
}

sealed class SessionSpeechState
{
    public List<SpeechRequestItem> Items { get; } = [];
    public int? ActiveUserId { get; set; }
    public long? ActiveContributionId { get; set; }
    public DateTime? ActiveSinceUtc { get; set; }
}

sealed class SpeechRequestStore
{
    private readonly object _sync = new();
    private readonly Dictionary<int, SessionSpeechState> _requestsBySession = new();

    private SessionSpeechState GetOrCreateState(int sessionId)
    {
        if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
        {
            sessionState = new SessionSpeechState();
            _requestsBySession[sessionId] = sessionState;
        }

        return sessionState;
    }

    private static void RemoveSessionIfEmpty(Dictionary<int, SessionSpeechState> all, int sessionId, SessionSpeechState state)
    {
        if (state.Items.Count == 0 && state.ActiveUserId is null)
        {
            all.Remove(sessionId);
        }
    }

    public bool Toggle(int sessionId, int userId)
    {
        lock (_sync)
        {
            var state = GetOrCreateState(sessionId);
            var existing = state.Items.Find(i => i.UserId == userId);
            if (existing is null)
            {
                state.Items.Add(new SpeechRequestItem
                {
                    UserId = userId,
                    RequestedAt = DateTime.UtcNow,
                    State = SpeechRequestState.Pending
                });
                return true;
            }

            if (existing.State == SpeechRequestState.Active)
            {
                return true;
            }

            state.Items.Remove(existing);
            RemoveSessionIfEmpty(_requestsBySession, sessionId, state);
            return false;
        }
    }

    public bool Add(int sessionId, int userId)
    {
        lock (_sync)
        {
            var state = GetOrCreateState(sessionId);

            if (state.Items.Any(i => i.UserId == userId))
            {
                return false;
            }

            state.Items.Add(new SpeechRequestItem
            {
                UserId = userId,
                RequestedAt = DateTime.UtcNow,
                State = SpeechRequestState.Pending
            });
            return true;
        }
    }

    public bool HasRequest(int sessionId, int userId)
    {
        lock (_sync)
        {
            return _requestsBySession.TryGetValue(sessionId, out var sessionState)
                && sessionState.Items.Any(i => i.UserId == userId);
        }
    }

    public HashSet<int> GetRequestingUsers(int sessionId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return [];
            }

            return sessionState.Items.Select(i => i.UserId).ToHashSet();
        }
    }

    public SpeechQueueSnapshot GetSnapshot(int sessionId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return new SpeechQueueSnapshot();
            }

            return new SpeechQueueSnapshot
            {
                ActiveUserId = sessionState.ActiveUserId,
                ActiveContributionId = sessionState.ActiveContributionId,
                ActiveSinceUtc = sessionState.ActiveSinceUtc,
                Items = sessionState.Items.Select(i => new SpeechQueueSnapshotItem
                {
                    UserId = i.UserId,
                    RequestedAt = i.RequestedAt,
                    State = i.State
                }).ToList()
            };
        }
    }

    public bool IsUserActive(int sessionId, int userId)
    {
        lock (_sync)
        {
            return _requestsBySession.TryGetValue(sessionId, out var sessionState)
                && sessionState.ActiveUserId == userId;
        }
    }

    public ActiveContributionRef? PauseActive(int sessionId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState)
                || sessionState.ActiveUserId is null
                || sessionState.ActiveContributionId is null
                || sessionState.ActiveSinceUtc is null)
            {
                return null;
            }

            var activeUserId = sessionState.ActiveUserId.Value;
            var activeItem = sessionState.Items.Find(i => i.UserId == activeUserId);
            if (activeItem is not null)
            {
                activeItem.State = SpeechRequestState.Paused;
            }

            var result = new ActiveContributionRef
            {
                UserId = activeUserId,
                ContributionId = sessionState.ActiveContributionId.Value,
                StartedAtUtc = sessionState.ActiveSinceUtc.Value
            };

            sessionState.ActiveUserId = null;
            sessionState.ActiveContributionId = null;
            sessionState.ActiveSinceUtc = null;
            RemoveSessionIfEmpty(_requestsBySession, sessionId, sessionState);
            return result;
        }
    }

    public bool Activate(int sessionId, int userId, long contributionId, DateTime startedAtUtc)
    {
        lock (_sync)
        {
            var sessionState = GetOrCreateState(sessionId);
            var item = sessionState.Items.Find(i => i.UserId == userId);
            if (item is null)
            {
                return false;
            }

            if (sessionState.ActiveUserId is not null && sessionState.ActiveUserId != userId)
            {
                return false;
            }

            item.State = SpeechRequestState.Active;
            sessionState.ActiveUserId = userId;
            sessionState.ActiveContributionId = contributionId;
            sessionState.ActiveSinceUtc = startedAtUtc;
            return true;
        }
    }

    public (bool Removed, bool WasActive, ActiveContributionRef? Contribution) StopAndRemove(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return (false, false, null);
            }

            var item = sessionState.Items.Find(i => i.UserId == userId);
            if (item is null)
            {
                return (false, false, null);
            }

            ActiveContributionRef? contribution = null;
            var wasActive = sessionState.ActiveUserId == userId;
            if (wasActive && sessionState.ActiveContributionId is not null && sessionState.ActiveSinceUtc is not null)
            {
                contribution = new ActiveContributionRef
                {
                    UserId = userId,
                    ContributionId = sessionState.ActiveContributionId.Value,
                    StartedAtUtc = sessionState.ActiveSinceUtc.Value
                };
                sessionState.ActiveUserId = null;
                sessionState.ActiveContributionId = null;
                sessionState.ActiveSinceUtc = null;
            }

            sessionState.Items.Remove(item);
            RemoveSessionIfEmpty(_requestsBySession, sessionId, sessionState);
            return (true, wasActive, contribution);
        }
    }

    public bool MoveTop(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return false;
            }

            var index = sessionState.Items.FindIndex(i => i.UserId == userId);
            if (index <= 0)
            {
                return index == 0;
            }

            var item = sessionState.Items[index];
            sessionState.Items.RemoveAt(index);
            sessionState.Items.Insert(0, item);
            return true;
        }
    }

    public bool MoveUp(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return false;
            }

            var index = sessionState.Items.FindIndex(i => i.UserId == userId);
            if (index <= 0)
            {
                return index == 0;
            }

            (sessionState.Items[index - 1], sessionState.Items[index]) = (sessionState.Items[index], sessionState.Items[index - 1]);
            return true;
        }
    }

    public bool MoveDown(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return false;
            }

            var index = sessionState.Items.FindIndex(i => i.UserId == userId);
            if (index < 0 || index >= sessionState.Items.Count - 1)
            {
                return index == sessionState.Items.Count - 1;
            }

            (sessionState.Items[index + 1], sessionState.Items[index]) = (sessionState.Items[index], sessionState.Items[index + 1]);
            return true;
        }
    }

    public void ClearUserRequest(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return;
            }

            var item = sessionState.Items.Find(i => i.UserId == userId);
            if (item is not null)
            {
                sessionState.Items.Remove(item);
            }

            if (sessionState.ActiveUserId == userId)
            {
                sessionState.ActiveUserId = null;
                sessionState.ActiveContributionId = null;
                sessionState.ActiveSinceUtc = null;
            }

            RemoveSessionIfEmpty(_requestsBySession, sessionId, sessionState);
        }
    }

    public ActiveContributionRef? GetActiveContribution(int sessionId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState)
                || sessionState.ActiveUserId is null
                || sessionState.ActiveContributionId is null
                || sessionState.ActiveSinceUtc is null)
            {
                return null;
            }

            return new ActiveContributionRef
            {
                UserId = sessionState.ActiveUserId.Value,
                ContributionId = sessionState.ActiveContributionId.Value,
                StartedAtUtc = sessionState.ActiveSinceUtc.Value
            };
        }
    }

    public void ClearSession(int sessionId)
    {
        lock (_sync)
        {
            _requestsBySession.Remove(sessionId);
        }
    }

    public void RemoveStaleRequests(int sessionId, IEnumerable<int> activeUserIds)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionState))
            {
                return;
            }

            var activeSet = activeUserIds.ToHashSet();
            sessionState.Items.RemoveAll(i => !activeSet.Contains(i.UserId));

            if (sessionState.ActiveUserId is not null && !activeSet.Contains(sessionState.ActiveUserId.Value))
            {
                sessionState.ActiveUserId = null;
                sessionState.ActiveContributionId = null;
                sessionState.ActiveSinceUtc = null;
            }

            RemoveSessionIfEmpty(_requestsBySession, sessionId, sessionState);
        }
    }
}
