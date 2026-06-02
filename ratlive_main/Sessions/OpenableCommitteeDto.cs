namespace RatLiveMain.Sessions;

sealed class OpenableCommitteeDto
{
    public int CommitteeId { get; init; }
    public string CommitteeName { get; init; } = string.Empty;
}
