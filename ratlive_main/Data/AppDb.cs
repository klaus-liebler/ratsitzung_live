namespace RatLiveMain.Data;

sealed class AppDb
{
    public AppDb(string connectionString)
    {
        ConnectionString = connectionString;
    }

    public string ConnectionString { get; }
}
