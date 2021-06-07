using System;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.eShopOnContainers.Services.Identity.API.Models;
using Microsoft.Extensions.DependencyInjection;
using Prometheus;

namespace Identity.API.Monitoring
{
    public static class UserMonitoring
    {
        private static readonly Gauge UserCount = Metrics
            .CreateGauge("identity_user_count", "Number of registered users.");

        public static void CollectUserCount(IServiceProvider sp)
        {
            var usermanager = sp.GetRequiredService<UserManager<ApplicationUser>>();

            Metrics.DefaultRegistry.AddBeforeCollectCallback(async (cancel) =>
            {
                var userCount = await usermanager.Users.CountAsync();
                UserCount.Set(userCount);
            });

        }

    }

}