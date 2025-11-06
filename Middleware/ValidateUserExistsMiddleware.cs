using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;

namespace JIRA_NTB.Middleware
{
	public class ValidateUserExistsMiddleware
	{
		private readonly RequestDelegate _next;

		public ValidateUserExistsMiddleware(RequestDelegate next)
		{
			_next = next;
		}

		public async Task InvokeAsync(HttpContext context, UserManager<UserModel> userManager, SignInManager<UserModel> signInManager)
		{
			// Chỉ kiểm tra nếu user đã đăng nhập
			if (context.User.Identity?.IsAuthenticated == true)
			{
				var userId = userManager.GetUserId(context.User);
				
				if (!string.IsNullOrEmpty(userId))
				{
					var user = await userManager.FindByIdAsync(userId);
					
					// Nếu user không còn tồn tại trong database
					if (user == null)
					{
						// Đăng xuất user
						await signInManager.SignOutAsync();
						
						// Redirect về trang login
						context.Response.Redirect("/Account/Login");
						return;
					}
				}
			}

			await _next(context);
		}
	}
}
