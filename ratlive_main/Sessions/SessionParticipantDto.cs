namespace RatLiveMain.Sessions;

sealed class SessionParticipantDto
{
    public int UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string JoinedAt { get; init; } = string.Empty;
    public bool HasSpeechRequest { get; init; }
}
