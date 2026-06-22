using JojoRpg.Application.Ports.Persistence;
using JojoRpg.Data.Generated;
using JojoRpg.Data.Repositories;
using LinqToDB;
using Microsoft.Extensions.DependencyInjection;

namespace JojoRpg.Data;

public static class DependencyInjection
{
    public static IServiceCollection AddJojoRpgData(this IServiceCollection services, string connectionString)
    {
        services.AddSingleton(_ =>
        {
            DataOptions baseOptions = new DataOptions().UseSqlServer(connectionString);
            return new DataOptions<JojoDataConnection>(baseOptions);
        });

        services.AddScoped(sp =>
        {
            DataOptions<JojoDataConnection> options = sp.GetRequiredService<DataOptions<JojoDataConnection>>();
            return new JojoDataConnection(options);
        });
        services.AddScoped<IRoomRepository, Linq2DbRoomRepository>();
        services.AddScoped<IPlayerRepository, Linq2DbPlayerRepository>();
        services.AddScoped<ISessionRepository, Linq2DbSessionRepository>();

        return services;
    }
}
