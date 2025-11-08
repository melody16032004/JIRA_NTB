using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;

namespace JIRA_NTB.Middleware
{
	public class ValidateUserExistsMiddleware
	{
		private readonly RequestDelegate _next;
		private readonly ILogger<ValidateUserExistsMiddleware> _logger;

		public ValidateUserExistsMiddleware(RequestDelegate next, ILogger<ValidateUserExistsMiddleware> logger)
		{
			_next = next;
			_logger = logger;
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
						// Log thông tin user không tồn tại
						_logger.LogWarning($"User {userId} does not exist in the database.");

						// Đăng xuất user
						await signInManager.SignOutAsync();

						// Redirect về trang login
						context.Response.Redirect("/Account/Login?error=account-deleted");
						return;
					}
					if (!user.IsActive)
					{
						// Log thông tin user không còn active
						_logger.LogWarning($"User {userId} is not active.");

						// Đăng xuất user
						await signInManager.SignOutAsync();

						// Redirect về trang login
						context.Response.Redirect("/Account/Login?error=account-locked");
						return;
					}

					if (!user.EmailConfirmed)
					{
						// Log thông tin user chưa xác nhận email
						_logger.LogWarning($"User {userId} has not confirmed their email.");

						// Đăng xuất user
						await signInManager.SignOutAsync();

						// Redirect về trang login
						context.Response.Redirect("/Account/Login?error=email-not-confirmed");
						return;
					}
				}
			}
			await _next(context);
		}
	}
}
