using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using RatLiveMain.Bootstrap;
using RatLiveMain.Data;
using RatLiveMain.Endpoints;
using RatLiveMain.Options;
using RatLiveMain.Sessions;

var builder = WebApplication.CreateBuilder(args);

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var bootstrapOptions = builder.Configuration.GetSection("Bootstrap").Get<BootstrapOptions>() ?? new BootstrapOptions();
var databaseOptions = builder.Configuration.GetSection("Database").Get<DatabaseOptions>() ?? new DatabaseOptions();

var dbPath = Path.IsPathRooted(databaseOptions.Path)
	? databaseOptions.Path
	: Path.Combine(builder.Environment.ContentRootPath, databaseOptions.Path);

var connectionString = $"Data Source={dbPath}";
var repoRoot = Directory.GetParent(builder.Environment.ContentRootPath)?.FullName ?? builder.Environment.ContentRootPath;

builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton(bootstrapOptions);
builder.Services.AddSingleton(new AppDb(connectionString));
builder.Services.AddSingleton<SpeechRequestStore>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
	.AddJwtBearer(options =>
	{
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateIssuerSigningKey = true,
			ValidateLifetime = true,
			ClockSkew = TimeSpan.FromMinutes(1),
			ValidIssuer = jwtOptions.Issuer,
			ValidAudience = jwtOptions.Audience,
			IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey))
		};
	});

builder.Services.AddAuthorization();

var app = builder.Build();

DatabaseBootstrapper.EnsureDatabaseSchema(repoRoot, dbPath, connectionString);

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapSessionEndpoints();

app.MapGet("/api/health", () => Results.Ok(new { ok = true, utc = DateTime.UtcNow }));

app.Run();
