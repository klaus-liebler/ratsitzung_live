namespace RatLiveMain.Options;

sealed class JwtOptions
{
    public string Issuer { get; set; } = "RatLive";
    public string Audience { get; set; } = "RatLive.Client";
    public string SigningKey { get; set; } = "ratlive_dev_only_replace_this_secret_key_2026";
    public int ExpiresInMinutes { get; set; } = 60;
}
