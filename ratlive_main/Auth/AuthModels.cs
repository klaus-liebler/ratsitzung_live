namespace RatLiveMain.Auth;

sealed record LoginRequest(string Username, string Password);
sealed record ChangePasswordRequest(string NewPassword);
sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool MustChangePassword, string DisplayName);

sealed class LoginUser
{
    public int Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string PasswordHash { get; init; } = string.Empty;
    public bool MustChangePassword { get; init; }
    public string? DeactivationDt { get; init; }
}

sealed class MeUser
{
    public int Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public bool MustChangePassword { get; init; }
}
