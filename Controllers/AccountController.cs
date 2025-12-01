using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.ViewModels;
using JIRA_NTB.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.WebUtilities;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Text;
using System.Text.RegularExpressions;

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

		#region GET: api/client/ip

		[HttpGet("api/server/address")]

		public IActionResult GetClientIp()
		{
			var ipAddress = HttpContext.Connection.LocalIpAddress?.ToString();

			var mac = NetworkInterface.GetAllNetworkInterfaces()
				.Where(nic => nic.OperationalStatus == OperationalStatus.Up && nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
				.Select(nic => nic.GetPhysicalAddress().ToString())
				.FirstOrDefault();

			// Format MAC cho dễ đọc: "AA:BB:CC:DD:EE:FF"
			if (!string.IsNullOrEmpty(mac))
				mac = string.Join(":", Enumerable.Range(0, mac.Length / 2).Select(i => mac.Substring(i * 2, 2)));

			var accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
			
			// --- Ghi log vào file ---
			var logLine = $"{accessTime} - IP: {ipAddress ?? "Không xác định"} - MAC: {mac ?? "Không xác định"}";
			var logPath = Path.Combine(AppContext.BaseDirectory, "access_log.txt");
			
			try
			{
				System.IO.File.AppendAllText(logPath, logLine + Environment.NewLine);
			}

			catch (Exception ex)
			{
				// Nếu muốn, có thể log lỗi ghi file ra console
				Console.WriteLine("❌ Lỗi ghi log: " + ex.Message);
			}

			return Ok(new
			{
				ip = ipAddress ?? "Không xác định",
				mac = mac ?? "Không xác định",
				accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
			});
		}
		#endregion

		#region GET: api/client/mac
		[HttpGet("api/client/address")]
		public IActionResult GetClientMac()
		{
			string clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
			if (string.IsNullOrEmpty(clientIp))

			return BadRequest("Không tìm thấy IP client");

			try
			{
				var process = new Process
				{
					StartInfo = new ProcessStartInfo
					{
						FileName = "arp",
						Arguments = "-a " + clientIp,
						RedirectStandardOutput = true,
						UseShellExecute = false,
						CreateNoWindow = true
					}
				};
				process.Start();
				string output = process.StandardOutput.ReadToEnd();
				process.WaitForExit();

				// Parse MAC (Windows format)
				var match = System.Text.RegularExpressions.Regex.Match(output, "([0-9A-Fa-f]{2}(-[0-9A-Fa-f]{2}){5})");
				string macAddress = match.Success ? match.Value.ToUpper().Replace('-', ':') : "Không xác định";
				var accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

				// --- Ghi log vào file ---
				var logLine = $"{accessTime} - IP: {clientIp ?? "Không xác định"} - MAC: {macAddress ?? "Không xác định"}";
				var logPath = Path.Combine(AppContext.BaseDirectory, "access_log.txt");
				try
				{
					System.IO.File.AppendAllText(logPath, logLine + Environment.NewLine);
				}
				catch (Exception ex)
				{
					// Nếu muốn, có thể log lỗi ghi file ra console
					Console.WriteLine("❌ Lỗi ghi log: " + ex.Message);
				}
				return Ok(new {
					ip = clientIp,
					mac = macAddress,
					accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
				});
			}
			catch (Exception ex)
			{ 
				return BadRequest($"Lỗi: {ex.Message}");
			}
		}
		#endregion

		#region Login
		[HttpGet]
		public IActionResult Login()
		{
			if (User.Identity.IsAuthenticated)
			{
				return RedirectToAction("Index", "Welcome");
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
					return RedirectToAction("Index", "Welcome");
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
		#endregion

		#region Logout
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Logout()
		{
			await _signInManager.SignOutAsync();
			return RedirectToAction("Login", "Account");
		}
		#endregion

		#region Register
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
            // --- [LOGIC ĐĂNG KÝ USER] ---
            if (ModelState.IsValid)
            {
                var existingEmail = await _userManager.FindByEmailAsync(model.Email);
                if (existingEmail != null)
                {
                    ModelState.AddModelError("Email", "Email này đã được sử dụng.");

                    model.DepartmentList = _context.Departments
                        .Select(d => new SelectListItem { Value = d.IdDepartment, Text = d.DepartmentName })
                        .ToList();
                    return View(model);
                }

                var user = new UserModel
                {
                    IdDepartment = model.DepartmentId.ToString(),
                    FullName = model.FullName,
                    UserName = model.Email,
                    Email = model.Email,
                    DeviceAddress = model.DeviceAddress // vẫn lấy từ form (hidden input) nếu có
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    UnconfirmedAccountCleanupService.AddPendingAccount(user.Id);
                    await _userManager.AddToRoleAsync(user, "EMPLOYEE");

                    try
                    {
                        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
                        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

                        var callbackUrl = Url.Action(
                            "ConfirmEmail",
                            "Account",
                            new { userId = user.Id, token = encodedToken },
                            protocol: Request.Scheme
                        );

                        await _emailSender.SendEmailAsync(
                            model.Email,
                            "Xác nhận tài khoản của bạn",
                            $@"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
								<h2 style='color: #9333ea;'>Xác nhận tài khoản của bạn</h2>
								<p>Chào mừng bạn đến với <strong>JIRA NTB</strong>!</p>
								<p>Vui lòng xác nhận tài khoản bằng cách bấm vào nút bên dưới:</p>
								<p style='margin: 30px 0;'>
									<a href='{callbackUrl}' 
									   style='background: linear-gradient(to right, #9333ea, #ec4899);
									   color: white; padding: 12px 30px; text-decoration: none; 
									   border-radius: 8px; display: inline-block; font-weight: bold;'>
										Xác nhận Email
									</a>
								</p>
								<p style='color: #6b7280; font-size: 12px; word-break: break-all;'>{callbackUrl}</p>
							</div>"
                        );
                    }
                    catch (Exception ex)
                    {
                        //System.Diagnostics.Debug.WriteLine("Gửi email thất bại: " + ex.Message);
                        return RedirectToAction("HttpStatusCodeHandler", "Error", new { statusCode = 500 });
                    }

                    TempData["RegisteredEmail"] = model.Email;
                    return RedirectToAction("RegisterConfirmation");
                }

                // Nếu tạo user thất bại
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }
            }

            // Reload lại danh sách phòng ban trước khi trả về View nếu có lỗi
            model.DepartmentList = _context.Departments
                .Select(d => new SelectListItem
                {
                    Value = d.IdDepartment,
                    Text = d.DepartmentName
                })
                .ToList();

            return View(model);
        }
        #endregion

        #region Email Confirmation
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
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> ResendEmailConfirmation(string email)
		{
			if (string.IsNullOrEmpty(email))
			{
				TempData["ErrorMessage"] = "Email không hợp lệ.";
				return RedirectToAction("Login");
			}

			var user = await _userManager.FindByEmailAsync(email);

			if (user == null)
			{
				TempData["ErrorMessage"] = "Không tìm thấy tài khoản với email này.";
				return RedirectToAction("Login");
			}

			if (await _userManager.IsEmailConfirmedAsync(user))
			{
				TempData["SuccessMessage"] = "Email đã được xác nhận rồi. Bạn có thể đăng nhập.";
				return RedirectToAction("Login");
			}

			try
			{
				var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
				var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

				var callbackUrl = Url.Action(
					"ConfirmEmail",
					"Account",
					new { userId = user.Id, token = encodedToken },
					protocol: Request.Scheme
				);

				await _emailSender.SendEmailAsync(
					email,
					"Xác nhận tài khoản của bạn",
					$@"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
						<h2 style='color: #9333ea;'>Xác nhận tài khoản của bạn</h2>
						<p>Chào mừng bạn đến với <strong>JIRA NTB</strong>!</p>
						<p>Vui lòng xác nhận tài khoản bằng cách bấm vào nút bên dưới:</p>
						<p style='margin: 30px 0;'>
							<a href='{callbackUrl}' 
							   style='background: linear-gradient(to right, #9333ea, #ec4899);
							   color: white; padding: 12px 30px; text-decoration: none; 
							   border-radius: 8px; display: inline-block; font-weight: bold;'>
								Xác nhận Email
							</a>
						</p>
						<p style='color: #6b7280; font-size: 12px; word-break: break-all;'>{callbackUrl}</p>
					</div>"
				);

				TempData["SuccessMessage"] = "✅ Email xác nhận đã được gửi lại! Vui lòng kiểm tra hộp thư và xác nhận trong 60 giây.";
			}
			catch (Exception ex)
			{
				TempData["ErrorMessage"] = "❌ Không thể gửi email. Vui lòng thử lại sau.";
			}

			TempData["RegisteredEmail"] = email;
			return RedirectToAction("RegisterConfirmation");
		}
		#endregion

		#region Forgot Password
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
		#endregion

		#region Reset Password
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
		#endregion

		#region Profile
		[Authorize] // Yêu cầu phải đăng nhập
		[HttpGet]
		public async Task<IActionResult> Profile()
		{
			// Lấy thông tin user đang đăng nhập
			var user = await _userManager.GetUserAsync(User);
			if (user == null)
			{
				return NotFound();
			}

			// Lấy thông tin phòng ban
			string departmentName = "Chưa phân bổ";
			if (!string.IsNullOrEmpty(user.IdDepartment))
			{
				var department = await _context.Departments.FindAsync(user.IdDepartment);
				if (department != null)
				{
					departmentName = department.DepartmentName;
				}
			}

			// Ánh xạ dữ liệu từ UserModel sang ProfileViewModel
			var model = new ProfileViewModel
			{
				Email = user.Email,
				DepartmentName = user.Department?.DepartmentName ?? "Chưa phân bổ",
				FullName = user.FullName,
				Dob = user.Dob,
				Gender = user.Gender,
				CurrentAvatarPath = user.Avt
			};

			return View(model);
		}

		[Authorize]
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Profile(ProfileViewModel model)
		{
			var user = await _userManager.GetUserAsync(User);
			if (user == null)
			{
				return NotFound();
			}

			// Nếu model không hợp lệ (ví dụ: FullName bị để trống)
			if (!ModelState.IsValid)
			{
				// Phải load lại thông tin không cho sửa trước khi trả về View
				var department = await _context.Departments.FindAsync(user.IdDepartment);
				model.Email = user.Email;
				model.DepartmentName = department?.DepartmentName ?? "Chưa có";
				return View(model); // Trả về view với thông báo lỗi
			}

			// Cập nhật thông tin từ ViewModel vào UserModel
			user.FullName = model.FullName;
			user.Dob = model.Dob;
			user.Gender = model.Gender;

			// Lưu thay đổi vào Database (Cách trực tiếp)
			try
			{
				_context.Users.Update(user);
				await _context.SaveChangesAsync();

				// Thông báo thành công và TẢI LẠI TRANG
				TempData["SuccessMessage"] = "Cập nhật thông tin thành công!";
				return RedirectToAction("Profile");
			}
			catch (Exception ex)
			{
				ModelState.AddModelError(string.Empty, "Lỗi khi lưu vào database: " + ex.Message);
			}

			// Load lại thông tin không cho sửa
			var dept = await _context.Departments.FindAsync(user.IdDepartment);
			model.Email = user.Email;
			model.DepartmentName = dept?.DepartmentName ?? "Chưa có";
			return View(model);
		}
        #endregion
        #region API CHO WPF APP (Thêm mới)

        // Model nhận dữ liệu từ WPF gửi lên
        public class AppLoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }

        public class BindMacRequest
        {
            public string UserId { get; set; }
            public string MacAddress { get; set; }
        }

        // API 1: Đăng nhập từ App để lấy thông tin User và DeviceAddress hiện tại
        [HttpPost("api/app/login")]
        [AllowAnonymous] // Cho phép gọi mà không cần cookie
        [IgnoreAntiforgeryToken] // Tắt check CSRF vì gọi từ App Client
        public async Task<IActionResult> LoginFromApp([FromBody] AppLoginRequest request)
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Vui lòng nhập Email và Mật khẩu" });
            }

            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return Unauthorized(new { message = "Email không tồn tại" });
            }

            // Kiểm tra mật khẩu (Không tạo Cookie, chỉ check đúng sai)
            var isPassValid = await _userManager.CheckPasswordAsync(user, request.Password);
            if (!isPassValid)
            {
                return Unauthorized(new { message = "Mật khẩu không đúng" });
            }

            if (!user.IsActive)
            {
                return StatusCode(403, new { message = "Tài khoản đã bị khóa" });
            }

            // Trả về thông tin cần thiết cho WPF App xử lý logic
            return Ok(new
            {
                userId = user.Id,
                fullName = user.FullName,
                email = user.Email,
                deviceAddress = user.DeviceAddress // WPF sẽ kiểm tra cái này: null, khác MAC, hay trùng MAC
            });
        }

        // API 2: Gán MAC Address cho User (Chỉ gọi khi DeviceAddress đang null)
        [HttpPost("api/app/bind-mac")]
        [AllowAnonymous]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> BindDeviceAddress([FromBody] BindMacRequest request)
        {
            if (string.IsNullOrEmpty(request.UserId) || string.IsNullOrEmpty(request.MacAddress))
            {
                return BadRequest(new { message = "Thiếu thông tin UserID hoặc MAC" });
            }

            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return NotFound(new { message = "User không tồn tại" });
            }

            // 🟢 SỬA ĐOẠN NÀY:
            // Kiểm tra xem thiết bị có đang "trống" không (bao gồm cả NULL text và Không xác định)
            bool isDeviceFree = string.IsNullOrEmpty(user.DeviceAddress)
                                || user.DeviceAddress.Trim().ToUpper() == "NULL"
                                || user.DeviceAddress.Trim().Equals("Không xác định", StringComparison.OrdinalIgnoreCase);

            // Logic chặn: Nếu thiết bị KHÔNG TRỐNG và MAC mới KHÁC MAC cũ -> Thì mới báo lỗi
            if (!isDeviceFree && !string.Equals(user.DeviceAddress, request.MacAddress, StringComparison.OrdinalIgnoreCase))
            {
                // Debug log (nếu cần): Console.WriteLine($"Conflict: DB={user.DeviceAddress} vs Request={request.MacAddress}");
                return StatusCode(409, new { message = "Tài khoản này đã được gắn với thiết bị khác rồi!" });
            }

            // Nếu vượt qua được đoạn check trên, tiến hành Ghi/Ghi đè
            user.DeviceAddress = request.MacAddress;

            var result = await _userManager.UpdateAsync(user);

            if (result.Succeeded)
            {
                return Ok(new { message = "Gắn kết thiết bị thành công" });
            }

            return StatusCode(500, new { message = "Lỗi khi cập nhật Database" });
        }

        #endregion
    }
}
