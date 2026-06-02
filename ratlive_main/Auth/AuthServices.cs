using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Isopoh.Cryptography.Argon2;
using Microsoft.IdentityModel.Tokens;
using RatLiveMain.Options;

namespace RatLiveMain.Auth;

static class PasswordService
{
    public static bool IsStrongEnough(string password)
    {
        return password.Length >= 10
            && password.Any(char.IsDigit)
            && password.Any(char.IsUpper);
    }

    public static bool Verify(string storedHash, string password, string demoInitialPassword)
    {
        if (storedHash.StartsWith("$argon2id$", StringComparison.Ordinal))
        {
            return Argon2.Verify(storedHash, password);
        }

        if (storedHash.StartsWith("argon2id$demo$", StringComparison.Ordinal))
        {
            return password == demoInitialPassword;
        }

        return false;
    }

    public static string Hash(string password)
    {
        return Argon2.Hash(password);
    }
}

static class AuthTokenService
{
    public static bool TryGetUserId(ClaimsPrincipal principal, out int userId)
    {
        var raw = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out userId);
    }

    public static string CreateToken(LoginUser user, JwtOptions jwt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new("display_name", $"{user.FirstName} {user.LastName}")
        };

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(jwt.ExpiresInMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
