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

		[HttpGet]
		public async Task<IActionResult> Index(string searchString, string department, int pageNumber = 1)
		{
			
			if (!User.IsInRole("ADMIN"))
			{
				return Forbid();
			}

			int pageSize = 10; // Số mục trên mỗi trang

			// Lấy tất cả user
			var users = _userManager.Users
				.Where(u => u.UserName != User.Identity.Name) // Loại bỏ chính user hiện tại
				.Include(u => u.Department)
				.AsQueryable();

			// Lọc theo chuỗi tìm kiếm (email hoặc tên đầy đủ)
			if (!string.IsNullOrEmpty(searchString))
			{
				users = users.Where(u => u.Email.Contains(searchString) || u.FullName.Contains(searchString));
			}

			// Lọc theo phòng ban
			if (!string.IsNullOrEmpty(department))
			{
				users = users.Where(u => u.Department != null && u.Department.DepartmentName == department);
			}

			// Sắp xếp theo tên
			users = users.OrderBy(u => u.FullName);

			// Tạo danh sách phân trang
			var paginatedUsers = PaginatedList<UserModel>.Create(users, pageNumber, pageSize);
			
			// Lấy danh sách phòng ban để hiển thị trong dropdown filter
			var departments = await _userManager.Users
        		.Where(u => u.Department != null)
        		.Select(u => u.Department!.DepartmentName)
        		.Distinct()
        		.OrderBy(d => d)
        		.ToListAsync();

			ViewBag.Departments = departments;
			ViewBag.CurrentSearch = searchString;
			ViewBag.CurrentDepartment = department;

			// Đếm số LEADER (không tính ADMIN)
			var allUsers = await _userManager.Users.ToListAsync();
			int leaderCount = 0;
			foreach (var u in allUsers)
			{
				var userRoles = await _userManager.GetRolesAsync(u);
				if (userRoles.Contains("LEADER") && !userRoles.Contains("ADMIN"))
				{
					leaderCount++;
				}
			}
			ViewBag.LeaderCount = leaderCount;

			return View(paginatedUsers);
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

			// 5. Kiểm tra nếu gán LEADER: mỗi phòng ban chỉ có 1 LEADER
			if (roleName == "LEADER")
			{
				// Kiểm tra user có phòng ban chưa
				if (user.Department == null)
				{
					TempData["ErrorMessage"] = "Không thể gán LEADER cho nhân viên chưa có phòng ban.";
					return RedirectToAction("Index");
				}

				// Tìm LEADER hiện tại của phòng ban này (loại trừ ADMIN)
				var usersInDepartment = _userManager.Users
					.Where(u => u.Department != null && u.Department.IdDepartment == user.Department.IdDepartment)
					.ToList();

				foreach (var deptUser in usersInDepartment)
				{
					var roles = await _userManager.GetRolesAsync(deptUser);
					// Nếu là LEADER và không phải ADMIN
					if (roles.Contains("LEADER") && !roles.Contains("ADMIN") && deptUser.Id != userId)
					{
						// Hạ cấp LEADER cũ xuống EMPLOYEE
						await _userManager.RemoveFromRoleAsync(deptUser, "LEADER");
						await _userManager.AddToRoleAsync(deptUser, "EMPLOYEE");
					}
				}
			}

			// 6. Xóa TẤT CẢ role cũ của user hiện tại
			var currentRoles = await _userManager.GetRolesAsync(user);
			await _userManager.RemoveFromRolesAsync(user, currentRoles);

			// 7. Thêm role mới
			await _userManager.AddToRoleAsync(user, roleName);

			TempData["SuccessMessage"] = $"Đã gán quyền {roleName} cho {user.Email}";
			return RedirectToAction("Index");
		}
	}
}
