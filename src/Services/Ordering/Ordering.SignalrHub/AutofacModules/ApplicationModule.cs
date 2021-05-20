using System.Linq;
using System.Reflection;
using Autofac;
using Microsoft.eShopOnContainers.BuildingBlocks.EventBus.Abstractions;
using Microsoft.eShopOnContainers.BuildingBlocks.EventBus.Events;
using Microsoft.Extensions.DependencyInjection;
using Ordering.SignalrHub.IntegrationEvents;

namespace Ordering.SignalrHub.AutofacModules
{
    public static class ApplicationServiceCollectionExtensions
    {
        public static IServiceCollection AddApplicationModule(this IServiceCollection services)
        {


            services.RegisterIntegrationEventHandlers(typeof(OrderStatusChangedToAwaitingValidationIntegrationEvent).GetTypeInfo().Assembly);

            return services;
        }

        public static IServiceCollection RegisterIntegrationEventHandlers(this IServiceCollection services, Assembly assembly)
        {
            var assemblyTypes = assembly.GetExportedTypes();
            var eventTypes = assemblyTypes.Where(t => t.IsClass && t.GetInterface(typeof(IntegrationEvent).Name) is not null);
            var tuples = eventTypes.Select(eventType =>
            {
                var handlerInterfaceType = typeof(IIntegrationEventHandler<>).MakeGenericType(eventType);
                return (eventType, handlerInterfaceType);
            });

            foreach (var (eventType, handlerInterfaceType) in tuples)
            {
                var handlerImplemention = assemblyTypes
                    .Single(t => t.IsClass && handlerInterfaceType.IsAssignableFrom(t));
                services.AddTransient(handlerInterfaceType, handlerImplemention);
            }
            return services;
        }
    }
}
