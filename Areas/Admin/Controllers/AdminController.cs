using JIRA_NTB.Admin.ViewModels;
using JIRA_NTB.Data;
using JIRA_NTB.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Admin.Controllers
{
	[Area("Admin")]
	[Authorize(Roles = "ADMIN")]
	public class AdminController : Controller
	{
		private readonly UserManager<UserModel> _userManager;
		private readonly RoleManager<ApplicationRole> _roleManager;
		private readonly AppDbContext _context;
		public AdminController(UserManager<UserModel> userManager, RoleManager<ApplicationRole> roleManager, AppDbContext context)
		{
			_userManager = userManager;
			_roleManager = roleManager;
			_context = context;
		}
		public async Task<IActionResult> Index()
		{
			// Lấy tất cả user
			var currentUser = await _userManager.GetUserAsync(User);
			var users = await _userManager.Users
				.Where(u => u.Id != currentUser.Id)
				.Include(u => u.Department)
				.ToListAsync();
			return View(users);
		}

		// Hiển thị trang để gán/xóa quyền của 1 user
		[HttpGet]
		public async Task<IActionResult> ManageRoles(string userId)
		{
			var user = await _userManager.FindByIdAsync(userId);
			if(user == null)
			{
				return NotFound();
			}

			// Lấy tất cả các role hiện có (Admin, Leader, Employee)
			var allRoles = await _roleManager.Roles.ToListAsync();

			// Lấy các role mà user đang có
			var userRoles = await _userManager.GetRolesAsync(user);

			var model = new ManageRolesViewModel
			{
				UserId = user.Id,
				Email = user.Email,
				Roles = allRoles.Select(role => new RoleViewModel
				{
					RoleName = role.Name,
					// Check vào ô nếu user đang có quyền này
					IsSelected = userRoles.Contains(role.Name)
				}).ToList()
			};
			return View(model);
		}

		// Xử lý việc cập nhật quyền
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> ManageRoles(ManageRolesViewModel model)
		{
			var user = await _userManager.FindByIdAsync(model.UserId);
			if(user == null)
			{
				return NotFound();
			}

			// Lấy các role hiện tại của user
			var userRoles = await _userManager.GetRolesAsync(user);

			// Lặp qua danh sách role được gửi lên từ form
			foreach (var role in model.Roles)
			{
				// Nếu được check và user chưa có role
				if (role.IsSelected && !userRoles.Contains(role.RoleName))
				{
					await _userManager.AddToRoleAsync(user, role.RoleName);
				}
				// Nếu không check và user đang có role
				else if (!role.IsSelected && userRoles.Contains(role.RoleName))
				{
					await _userManager.RemoveFromRoleAsync(user, role.RoleName);
				}
			}
			// Quay về trang danh sách
			return RedirectToAction("Index");
		}

		// Toggle trạng thái IsActive của user
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> ToggleUserStatus(string userId)
		{
			var user = await _userManager.FindByIdAsync(userId);
			if (user == null)
			{
				return Json(new { success = false, message = "Không tìm thấy người dùng" });
			}

			// Đảo ngược trạng thái IsActive
			user.IsActive = !user.IsActive;
			var result = await _userManager.UpdateAsync(user);

			if (result.Succeeded)
			{
				return Json(new 
				{ 
					success = true, 
					isActive = user.IsActive,
					message = user.IsActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản" 
				});
			}

			return Json(new { success = false, message = "Không thể cập nhật trạng thái" });
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> SetUserRole(string userId, string roleName)
		{
			if(string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(roleName))
			{
				return BadRequest("UserId và RoleName không được để trống.");
			}

			// 2. Chỉ cho phép gán 2 role này
			if (roleName != "LEADER" && roleName != "EMPLOYEE")
			{
				// Ngăn admin cố gán role "ADMIN" qua form
				return RedirectToAction("Index");
			}

			var user = await _userManager.FindByIdAsync(userId);
			if (user == null)
			{
				return NotFound();
			}

			// 3. Ngăn Admin tự thay đổi role của chính mình
			var currentUser = await _userManager.GetUserAsync(User);
			if (user.Id == currentUser.Id)
			{
				// Thêm lỗi vào TempData để hiển thị
				TempData["ErrorMessage"] = "Bạn không thể thay đổi vai trò của chính mình.";
				return RedirectToAction("Index");
			}

			// 4. Ngăn admin thay đổi role của 1 admin khác
			if (await _userManager.IsInRoleAsync(user, "ADMIN"))
			{
				TempData["ErrorMessage"] = "Bạn không thể thay đổi vai trò của Quản trị viên khác.";
				return RedirectToAction("Index");
			}

			// 5. Xử lý gán role
			var currentRoles = await _userManager.GetRolesAsync(user);

			// Xóa TẤT CẢ role cũ
			await _userManager.RemoveFromRolesAsync(user, currentRoles);

			// Thêm role mới
			await _userManager.AddToRoleAsync(user, roleName);

			TempData["SuccessMessage"] = $"Đã gán quyền {roleName} cho {user.Email}";
			return RedirectToAction("Index");
		}
	}
}
