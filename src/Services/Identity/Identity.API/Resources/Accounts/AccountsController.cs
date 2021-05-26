using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.eShopOnContainers.Services.Identity.API.Models;
using Microsoft.eShopOnContainers.Services.Identity.API.Models.Commands;

namespace Microsoft.eShopOnContainers.Services.Ordering.API.Resources.Accounts
{
    [Route("api/v1/[controller]")]
    [Authorize]
    [ApiController]
    public class AccountsController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public AccountsController(
            UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        [HttpPut]
        [ProducesResponseType((int)HttpStatusCode.OK)]
        [ProducesResponseType((int)HttpStatusCode.BadRequest)]
        public async Task<IActionResult> CreateAccount([FromBody] CreateAccountRequest request)
        {
            if (ModelState.IsValid)
            {
                var user = new ApplicationUser
                {
                    UserName = request.Email,
                    Email = request.Email,
                    CardHolderName = request.User.CardHolderName,
                    CardNumber = request.User.CardNumber,
                    CardType = request.User.CardType,
                    City = request.User.City,
                    Country = request.User.Country,
                    Expiration = request.User.Expiration,
                    LastName = request.User.LastName,
                    Name = request.User.Name,
                    Street = request.User.Street,
                    State = request.User.State,
                    ZipCode = request.User.ZipCode,
                    PhoneNumber = request.User.PhoneNumber,
                    SecurityNumber = request.User.SecurityNumber
                };
                var result = await _userManager.CreateAsync(user, request.Password);
                if (result.Errors.Count() > 0)
                {
                    AddErrors(result);
                }
                else
                {
                    return Ok();
                }
            }
            return BadRequest(ModelState);
        }

        private void AddErrors(IdentityResult result)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(string.Empty, error.Description);
            }
        }
    }
}
