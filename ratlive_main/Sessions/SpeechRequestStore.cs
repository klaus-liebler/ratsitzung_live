namespace RatLiveMain.Sessions;

sealed class SpeechRequestStore
{
    private readonly object _sync = new();
    private readonly Dictionary<int, Dictionary<int, DateTime>> _requestsBySession = new();

    public bool Toggle(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionRequests))
            {
                sessionRequests = new Dictionary<int, DateTime>();
                _requestsBySession[sessionId] = sessionRequests;
            }

            if (sessionRequests.Remove(userId))
            {
                if (sessionRequests.Count == 0)
                {
                    _requestsBySession.Remove(sessionId);
                }

                return false;
            }

            sessionRequests[userId] = DateTime.UtcNow;
            return true;
        }
    }

    public bool HasRequest(int sessionId, int userId)
    {
        lock (_sync)
        {
            return _requestsBySession.TryGetValue(sessionId, out var sessionRequests)
                && sessionRequests.ContainsKey(userId);
        }
    }

    public HashSet<int> GetRequestingUsers(int sessionId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionRequests))
            {
                return [];
            }

            return sessionRequests.Keys.ToHashSet();
        }
    }

    public void ClearUserRequest(int sessionId, int userId)
    {
        lock (_sync)
        {
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionRequests))
            {
                return;
            }

            sessionRequests.Remove(userId);
            if (sessionRequests.Count == 0)
            {
                _requestsBySession.Remove(sessionId);
            }
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
            if (!_requestsBySession.TryGetValue(sessionId, out var sessionRequests))
            {
                return;
            }

            var activeSet = activeUserIds.ToHashSet();
            var staleIds = sessionRequests.Keys.Where(k => !activeSet.Contains(k)).ToList();

            foreach (var staleId in staleIds)
            {
                sessionRequests.Remove(staleId);
            }

            if (sessionRequests.Count == 0)
            {
                _requestsBySession.Remove(sessionId);
            }
        }
    }
}
