using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace JIRA_NTB.Extensions
{
    public class CustomUserClaimsPrincipalFactory : UserClaimsPrincipalFactory<UserModel, ApplicationRole>
    {
        public CustomUserClaimsPrincipalFactory(
            UserManager<UserModel> userManager,
            RoleManager<ApplicationRole> roleManager,
            IOptions<IdentityOptions> optionsAccessor)
            : base(userManager, roleManager, optionsAccessor)
        {
        }

        protected override async Task<ClaimsIdentity> GenerateClaimsAsync(UserModel user)
        {
            var identity = await base.GenerateClaimsAsync(user);

            // ✅ THÊM CLAIMS TÙY CHỈNH VÀO COOKIE
            identity.AddClaim(new Claim("UserId", user.Id));
            identity.AddClaim(new Claim("FullName", user.FullName ?? ""));
            identity.AddClaim(new Claim("IsActive", user.IsActive.ToString()));
            identity.AddClaim(new Claim("IdDepartment", user.IdDepartment ?? ""));

            // Roles đã được tự động thêm bởi base.GenerateClaimsAsync()

            return identity;
        }
    }
}
