using JIRA_NTB.Data;
using JIRA_NTB.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Admin.Controllers
{
	[Area("Admin")]
	[Authorize(Roles = "ADMIN")]
	public class DepartmentController : Controller
	{
		private readonly AppDbContext _context;
		public DepartmentController(AppDbContext context)
		{
			_context = context;
		}
		public async Task<IActionResult> Index()
		{
			var departments = await _context.Departments
				.Include(d => d.Users) // Load số lượng nhân viên
				.OrderBy(d => d.DepartmentName)
				.ToListAsync();
			return View(departments);
		}

		public IActionResult Create()
		{
			return View();
		}
		[HttpPost]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> Create(DepartmentModel department)
		{
			if (ModelState.IsValid)
			{
				_context.Departments.Add(department);
				await _context.SaveChangesAsync();
				return RedirectToAction(nameof(Index));
			}
			return View(department);
		}

		public async Task<IActionResult> Edit(string id)
		{
			if (id == null) return NotFound();
			var department = await _context.Departments.FindAsync(id);
			if (department == null) return NotFound();
			return View(department);
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

		public async Task<IActionResult> Delete(string id)
		{
			if (id == null)
			{
				return NotFound();
			}
			var department = await _context.Departments.FirstOrDefaultAsync(m => m.IdDepartment == id);
			if (department == null) return NotFound();
			return View(department);
		}

		[HttpPost, ActionName("Delete")]
		[ValidateAntiForgeryToken]
		public async Task<IActionResult> DeleteConfirmed(string id)
		{
			var department = await _context.Departments.FindAsync(id);
			if (department != null)
			{
				_context.Departments.Remove(department);
				await _context.SaveChangesAsync();
			}
			return RedirectToAction(nameof(Index));
		}
	}
}
