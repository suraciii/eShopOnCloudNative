using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.eShopOnContainers.BuildingBlocks.EventBus.Abstractions;
using Microsoft.Extensions.Logging;

namespace Ordering.SignalrHub.IntegrationEvents
{
    public class OrderStatusChangedToAwaitingValidationIntegrationEventHandler : IIntegrationEventHandler<OrderStatusChangedToAwaitingValidationIntegrationEvent>
    {
        private readonly IHubContext<NotificationsHub> _hubContext;
        private readonly ILogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler> _logger;

        public OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
            IHubContext<NotificationsHub> hubContext,
            ILogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler> logger)
        {
            _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }


        public async Task Handle(OrderStatusChangedToAwaitingValidationIntegrationEvent @event)
        {
            // using (LogContext.PushProperty("IntegrationEventContext", $"{@event.Id}-{Program.AppName}"))
            _logger.LogInformation("----- Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

            await _hubContext.Clients
                .Group(@event.BuyerName)
                .SendAsync("UpdatedOrderState", new { OrderId = @event.OrderId, Status = @event.OrderStatus });
        }
    }
}
