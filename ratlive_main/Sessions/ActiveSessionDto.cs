namespace RatLiveMain.Sessions;

sealed class ActiveSessionDto
{
    public int SessionId { get; init; }
    public int CommitteeId { get; init; }
    public string CommitteeName { get; init; } = string.Empty;
    public string OpenedDt { get; init; } = string.Empty;
    public string? StartDt { get; init; }
    public int StartUserId { get; init; }
    public string OpenedByDisplayName { get; init; } = string.Empty;
    public int ActiveParticipants { get; init; }
    public bool IsJoined { get; init; }
    public bool CanManageSession { get; init; }
}
