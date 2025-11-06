using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.ViewModels;
using JIRA_NTB.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.WebUtilities;
using System.Text;

namespace JIRA_NTB.Controllers
{
	public class AccountController : Controller
	{
		private UserManager<UserModel> _userManager;
		private SignInManager<UserModel> _signInManager;
		private readonly AppDbContext _context;
		private readonly IEmailSender _emailSender;
		private readonly IConfiguration _config;

		public AccountController(SignInManager<UserModel> signInManager, UserManager<UserModel> userManager, AppDbContext context, IEmailSender emailSender,
		IConfiguration config)
		{
			_signInManager = signInManager;
			_userManager = userManager;
			_context = context;
			_emailSender = emailSender;
			_config = config;
		}

		public IActionResult Index()
		{
			return View();
		}

		[HttpGet]
		public IActionResult Login()
		{
			if (User.Identity.IsAuthenticated)
			{
				return RedirectToAction("Index", "Home");
			}
			return View();
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Login(LoginViewModel model)
		{
			//TÌM USER BẰNG EMAIL TRƯỚC
			var user = await _userManager.FindByEmailAsync(model.Email);
			if (user == null)
			{
				ModelState.AddModelError(string.Empty, "❌ Email hoặc mật khẩu không đúng.");
				return View(model);
			}

			// KIỂM TRA TÌNH TRẠNG KÍCH HOẠT
			if (!user.IsActive)
			{
				ModelState.AddModelError(string.Empty, "⚠️ Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên.");
				return View(model);
			}

			if (ModelState.IsValid)
			{
				//KHI ĐÃ CÓ USER, KIỂM TRA MẬT KHẨU
				// isPersistent = model.RememberMe: Nếu checked → Cookie persistent (30 ngày)
				//                                  Nếu không → Session cookie (đóng browser = logout)
				var result = await _signInManager.PasswordSignInAsync(
					user,
					model.Password,
					isPersistent: model.RememberMe,
					lockoutOnFailure: false
				);

				if (result.Succeeded)
				{
					// Debug log để kiểm tra RememberMe
					Console.WriteLine($"✅ Login thành công - RememberMe: {model.RememberMe}");
					return RedirectToAction("Index", "Home");
				}

				if (result.IsNotAllowed)
				{
					ModelState.AddModelError(string.Empty, "⚠️ Tài khoản chưa được xác thực email.");
				}
				else if (result.IsLockedOut)
				{
					ModelState.AddModelError(string.Empty, "Tài khoản của bạn đã bị khóa.");
				}
				else
				{
					// Nếu sai mật khẩu, nó sẽ rơi vào đây
					ModelState.AddModelError(string.Empty, "❌ Email hoặc mật khẩu không đúng.");
				}
			}
			return View(model);
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Logout()
		{
			await _signInManager.SignOutAsync();
			return RedirectToAction("Login", "Account");
		}

		[HttpGet]
		public IActionResult Register()
		{
			var model = new RegisterViewModel
			{
				// Load danh sách phòng ban từ database
				DepartmentList = _context.Departments
			.Select(d => new SelectListItem
			{
				Value = d.IdDepartment,
				Text = d.DepartmentName
			})
			.ToList()
			};
			return View(model);
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Register(RegisterViewModel model)
		{
			if (ModelState.IsValid) // Kiểm tra xem Email, Pass có hợp lệ không
			{
				// Kiểm tra xem Email đã tồn tại chưa
				var existingEmail = await _userManager.FindByEmailAsync(model.Email);
				if (existingEmail != null)
				{
					ModelState.AddModelError("Email", "Email này đã được sử dụng.");

					// Load lại danh sách phòng ban khi có lỗi
					model.DepartmentList = _context.Departments
						.Select(d => new SelectListItem
						{
							Value = d.IdDepartment,
							Text = d.DepartmentName
						})
						.ToList();

					return View(model);
				}

				var user = new UserModel
				{
					IdDepartment = model.DepartmentId.ToString(),
					FullName = model.FullName,
					UserName = model.Email, // Sử dụng Email làm UserName
					Email = model.Email
				};
				var result = await _userManager.CreateAsync(user, model.Password);

				if (result.Succeeded)
				{
					// Thêm tài khoản vào danh sách chờ xác nhận (sẽ tự động xóa sau 10 phút nếu không xác nhận)
					UnconfirmedAccountCleanupService.AddPendingAccount(user.Id);

					// Gán role "Employee" cho user mới tạo
					await _userManager.AddToRoleAsync(user, "EMPLOYEE");

					// Generate token với custom provider (10 phút)
					var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
					var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

					// Dùng Url.Action để tạo link một cách an toàn
					var callbackUrl = Url.Action(
						"ConfirmEmail",    // Tên Action (Hàm 4)
						"Account",         // Tên Controller
						new { userId = user.Id, token = encodedToken }, // Tham số
						protocol: Request.Scheme // http hoặc https
					);

					await _emailSender.SendEmailAsync(
						model.Email,
						"Xác nhận tài khoản của bạn",
						$@"
						<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
							<h2 style='color: #9333ea;'>Xác nhận tài khoản của bạn</h2>
							<p>Chào mừng bạn đến với <strong>JIRA NTB</strong>!</p>
							<p>Vui lòng xác nhận tài khoản bằng cách bấm vào nút bên dưới:</p>
							<p style='margin: 30px 0;'>
								<a href='{callbackUrl}' 
								   style='background: linear-gradient(to right, #9333ea, #ec4899); 
								          color: white; 
								          padding: 12px 30px; 
								          text-decoration: none; 
								          border-radius: 8px; 
								          display: inline-block;
								          font-weight: bold;'>
									Xác nhận Email
								</a>
							</p>
							<p style='color: #dc2626; font-weight: bold;'>⚠️ LƯU Ý: Link xác nhận chỉ có hiệu lực trong vòng 60 giây!</p>
							<p style='color: #6b7280; font-size: 14px;'>Nếu bạn không thể bấm vào nút, hãy sao chép link sau vào trình duyệt:</p>
							<p style='color: #6b7280; font-size: 12px; word-break: break-all;'>{callbackUrl}</p>
							<hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;'>
							<p style='color: #9ca3af; font-size: 12px;'>Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.</p>
						</div>"
					);

					// Chuyển hướng đến trang thông báo
					return RedirectToAction("RegisterConfirmation");
				}

				// Nếu thất bại, thêm lỗi vào ModelState để View hiển thị
				foreach (var error in result.Errors)
				{
					ModelState.AddModelError(string.Empty, error.Description);
				}
			}

			// Reload lại danh sách phòng ban trước khi trả về View
			model.DepartmentList = _context.Departments
				.Select(d => new SelectListItem
				{
					Value = d.IdDepartment,
					Text = d.DepartmentName
				})
				.ToList();

			// trả về View cũ và hiển thị lỗi
			return View(model);
		}

		[HttpGet]
		public IActionResult RegisterConfirmation()
		{
			return View();
		}

		[HttpGet]
		public async Task<IActionResult> ConfirmEmail(string userId, string token)
		{
			if (userId == null || token == null)
			{
				return RedirectToAction("Index", "Home"); // Về trang chủ
			}

			var user = await _userManager.FindByIdAsync(userId);
			if (user == null)
			{
				return NotFound($"Không tìm thấy user với ID '{userId}'.");
			}

			try
			{
				var decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
				var result = await _userManager.ConfirmEmailAsync(user, decodedToken);

				if (result.Succeeded)
				{
					// Loại bỏ khỏi danh sách pending vì đã xác nhận thành công
					UnconfirmedAccountCleanupService.RemovePendingAccount(userId);

					// Trả về View thông báo thành công
					return View("ConfirmEmailSuccess");
				}
				else
				{
					// Trả về View thông báo lỗi
					return View("ConfirmEmailError");
				}
			}
			catch (Exception)
			{
				// Lỗi giải mã token
				return View("ConfirmEmailError");
			}
		}

		// ------ 1. Hiển thị trang yêu cầu ------
		[HttpGet]
		public IActionResult ForgotPassword()
		{
			return View();
		}

		// ------ 2. Xử lý việc gửi link ------
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> ForgotPassword(ForgotPasswordViewModel model)
		{
			if (ModelState.IsValid)
			{
				var user = await _userManager.FindByEmailAsync(model.Email);

				if (user == null || !(await _userManager.IsEmailConfirmedAsync(user)))
				{
					// Để tránh lộ thông tin, luôn hiển thị trang xác nhận
					return RedirectToAction("ForgotPasswordConfirmation");
				}

				// Nếu user tồn tại VÀ đã xác nhận email, thì tạo token
				var token = await _userManager.GeneratePasswordResetTokenAsync(user);
				var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

				var callbackUrl = Url.Action(
					"ResetPassword",    // Tên Action (Hàm 4)
					"Account",         // Tên Controller
					new { userId = user.Id, token = encodedToken }, // Tham số
					protocol: Request.Scheme // http hoặc https
				);

				// Gửi email (sao chép phong cách từ hàm Register của bạn)
				await _emailSender.SendEmailAsync(
					model.Email,
					"Yêu cầu đặt lại mật khẩu JIRA NTB",
					$@"
						<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
							<h2 style='color: #9333ea;'>Yêu cầu đặt lại mật khẩu</h2>
							<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>{user.Email}</strong> của bạn.</p>
							<p>Vui lòng bấm vào nút bên dưới để đặt lại mật khẩu:</p>
							<p style='margin: 30px 0;'>
								<a href='{callbackUrl}' 
								   style='background: linear-gradient(to right, #9333ea, #ec4899); 
										  color: white; 
										  padding: 12px 30px; 
										  text-decoration: none; 
										  border-radius: 8px; 
										  display: inline-block;
										  font-weight: bold;'>
									Đặt lại mật khẩu
								</a>
							</p>
							<p style='color: #dc2626; font-weight: bold;'>⚠️ LƯU Ý: Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
							<p style='color: #6b7280; font-size: 14px;'>Nếu bạn không thể bấm vào nút, hãy sao chép link sau vào trình duyệt:</p>
							<p style='color: #6b7280; font-size: 12px; word-break: break-all;'>{callbackUrl}</p>
							<hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;'>
						</div>"
				);
				// Chuyển hướng đến trang thông báo
				return RedirectToAction("ForgotPasswordConfirmation");
			}
			return View();
		}

		// ------ 3. Hiển thị trang thông báo đã gửi link ------
		[HttpGet]
		public IActionResult ForgotPasswordConfirmation()
		{
			return View();
		}

		// ------ 4. Hiển thị trang NHẬP MẬT KHẨU MỚI (khi user bấm link) ------
		[HttpGet]
		public IActionResult ResetPassword(string userId, string token)
		{
			if (userId == null || token == null)
			{
				ModelState.AddModelError(string.Empty, "Link đặt lại mật khẩu không hợp lệ.");
				return RedirectToAction("Login");
			}

			try
			{
				// Giải mã token
				var decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
			}
			catch (Exception)
			{
				ModelState.AddModelError(string.Empty, "Token không hợp lệ.");
				return View("Error");
			}
			var model = new ResetPasswordViewModel 
			{
				UserId = userId,
				Token = token
			};
			return View(model);
		}

		// ------ 5. Xử lý việc ĐẶT LẠI MẬT KHẨU MỚI (khi user submit form) ------
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> ResetPassword(ResetPasswordViewModel model)
		{
			if (!ModelState.IsValid)
			{
				return View(model); // Trả về View với lỗi
			}

			var user = await _userManager.FindByIdAsync(model.UserId);
			if (user == null)
			{
				// Không tiết lộ rằng user không tồn tại
				TempData["SuccessMessage"] = "Mật khẩu của bạn đã được đặt lại thành công. Vui lòng đăng nhập.";
				return RedirectToAction("Login");
			}

			// Giải mã token trước khi sử dụng
			string decodedToken;
			try
			{
				decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(model.Token));
			}
			catch (Exception)
			{
				ModelState.AddModelError(string.Empty, "Token không hợp lệ.");
				return View(model);
			}

			var result = await _userManager.ResetPasswordAsync(user, decodedToken, model.NewPassword);

			if (result.Succeeded)
			{
				// Tùy chọn: Nếu tài khoản bị khóa, hãy mở lại
				if (await _userManager.IsLockedOutAsync(user))
				{
					await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow);
				}

				TempData["SuccessMessage"] = "Mật khẩu của bạn đã được đặt lại thành công. Vui lòng đăng nhập.";
				return RedirectToAction("Login");
			}

			// Nếu thất bại (vd: token hết hạn, mật khẩu không đủ mạnh...)
			foreach (var error in result.Errors)
			{
				ModelState.AddModelError(string.Empty, error.Description);
			}
			return View(model);
		}
	}
}
