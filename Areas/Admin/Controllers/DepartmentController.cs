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
	public class DepartmentController : Controller
	{
		private readonly AppDbContext _context;
		private readonly UserManager<UserModel> _userManager;
		
		public DepartmentController(AppDbContext context, UserManager<UserModel> userManager)
		{
			_context = context;
			_userManager = userManager;
		}
		public async Task<IActionResult> Index(string searchString, int pageNumber = 1)
		{
			int pageSize = 5; // Số phòng ban trên mỗi trang

			var departments = _context.Departments
				.Include(d => d.Users) // Load số lượng nhân viên
				.AsQueryable();

			// Lọc theo tìm kiếm
			if (!string.IsNullOrEmpty(searchString))
			{
				departments = departments.Where(d => d.DepartmentName.Contains(searchString));
			}

			// Sắp xếp theo tên
			departments = departments.OrderBy(d => d.DepartmentName);

			// Tạo danh sách phân trang
			var paginatedDepartments = PaginatedList<DepartmentModel>.Create(departments, pageNumber, pageSize);

			ViewBag.CurrentSearch = searchString;

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

			return View(paginatedDepartments);
		}

		[HttpGet]
		public IActionResult Create()
		{
			return View();
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Create(string DepartmentName)
		{
			// 1. Kiểm tra thủ công xem DepartmentName có hợp lệ không
			if (string.IsNullOrWhiteSpace(DepartmentName))
			{
				TempData["ErrorMessage"] = "Thêm thất bại: Tên phòng ban không được để trống.";
				return RedirectToAction(nameof(Index));
			}

			// 2. Tạo đối tượng DepartmentModel mới
			var department = new DepartmentModel
			{
				DepartmentName = DepartmentName
				// IdDepartment sẽ được gán ở bước 3
			};

			// 3. Tự động tạo ID cho phòng ban (logic cũ của bạn)
			try
			{
				// Lấy *tất cả* các IdDepartment về C# (chỉ lấy cột ID)
				var allIdStrings = await _context.Departments
					.Select(d => d.IdDepartment)
					.ToListAsync();

				int maxNumber = 0;

				if (allIdStrings.Any())
				{
					// Dùng LINQ to Objects (C#) để tìm số lớn nhất
					// Nó sẽ thử parse từng ID, nếu thất bại
					// Nó sẽ trả về 0 cho ID đó, đảm bảo không bị crash
					maxNumber = allIdStrings
						.Select(idStr => {
							int.TryParse(idStr, out int number); // Thử chuyển "10" -> 10, "9" -> 9
							return number;
						})
						.Max(); // Tìm số lớn nhất (ví dụ: 10)
				}

				// 4. Gán ID mới bằng cách + 1
				// (Nếu maxNumber là 10, ID mới sẽ là "11")
				department.IdDepartment = (maxNumber + 1).ToString();

				// 5. Thêm và lưu vào database
				_context.Departments.Add(department);
				await _context.SaveChangesAsync();

				TempData["SuccessMessage"] = "Thêm phòng ban thành công!";
			}
			catch (Exception ex)
			{
				// Bắt lỗi nếu có
				TempData["ErrorMessage"] = "Thêm thất bại: " + ex.Message;
			}

			// Chuyển hướng về Index
			return RedirectToAction(nameof(Index));
		}

		[HttpGet]
		public async Task<IActionResult> GetDepartment(string id)
		{
			if (id == null) return NotFound();
			var department = await _context.Departments.FindAsync(id);
			if (department == null) return NotFound();
			return Json(department);
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Edit(string id, DepartmentModel department)
		{
			if(id != department.IdDepartment)
			{
				return NotFound();
			}
			if(ModelState.IsValid)
			{
				try
				{
					_context.Update(department);
					await _context.SaveChangesAsync();
				}
				catch (DbUpdateConcurrencyException)
				{
					if (!_context.Departments.Any(e => e.IdDepartment == id))
					{
						return NotFound();
					}
					else
					{
						throw;
					}
				}
				return RedirectToAction(nameof(Index));
			}
			return View(department);
		}

		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Delete(string IdDepartment)
		{
			if (string.IsNullOrEmpty(IdDepartment))
			{
				return NotFound();
			}

			var department = await _context.Departments.FindAsync(IdDepartment);
			if (department != null)
			{
				_context.Departments.Remove(department);
				await _context.SaveChangesAsync();
			}
			return RedirectToAction(nameof(Index));
		}
	}
}
