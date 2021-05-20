using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Microsoft.AspNetCore.Hosting
{
    public static class IWebHostExtensions
    {
        public static IHost MigrateDbContext<TContext>(this IHost host, Action<TContext, IServiceProvider> seeder) where TContext : DbContext
        {
            MigrateDbContext<TContext>(host.Services, seeder);
            return host;
        }

        public static IWebHost MigrateDbContext<TContext>(this IWebHost host, Action<TContext, IServiceProvider> seeder) where TContext : DbContext
        {
            MigrateDbContext<TContext>(host.Services, seeder);
            return host;
        }

        public static IApplicationBuilder MigrateDbContext<TContext>(this IApplicationBuilder app, Action<TContext, IServiceProvider> seeder) where TContext : DbContext
        {
            MigrateDbContext<TContext>(app.ApplicationServices, seeder);
            return app;
        }

        public static void MigrateDbContext<TContext>(this IServiceProvider sp, Action<TContext, IServiceProvider> seeder)
            where TContext : DbContext
        {
            using var scope = sp.CreateScope();
            var services = scope.ServiceProvider;
            var logger = services.GetRequiredService<ILogger<TContext>>();
            var context = services.GetRequiredService<TContext>();

            try
            {
                logger.LogInformation("Migrating database associated with context {DbContextName}", typeof(TContext).Name);
                InvokeSeeder(seeder, context, services);
                logger.LogInformation("Migrated database associated with context {DbContextName}", typeof(TContext).Name);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while migrating the database used on context {DbContextName}", typeof(TContext).Name);
                throw;
            }
        }

        private static void InvokeSeeder<TContext>(Action<TContext, IServiceProvider> seeder, TContext context, IServiceProvider services)
            where TContext : DbContext
        {
            context.Database.Migrate();
            seeder(context, services);
        }
    }
}
