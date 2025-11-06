using JIRA_NTB.Models;
using JIRA_NTB.Admin.Controllers;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace JIRA_NTB.Areas.Admin.ViewModels
{
	public class AdminIndexViewModel
	{
		// Dữ liệu hiển thị (SỬA TỪ List<> THÀNH PaginatedList<>)
		public PaginatedList<UserModel> Users { get; set; }

		// Dữ liệu cho Stats Cards (THÊM CÁC DÒNG NÀY)
		public int TotalCount { get; set; }
		public int ConfirmedCount { get; set; }
		public int UnconfirmedCount { get; set; }
		public int ActiveCount { get; set; }

		// Dữ liệu cho các dropdown (Giữ nguyên)
		public SelectList DepartmentList { get; set; }
		public SelectList RoleList { get; set; }

		// Dữ liệu để giữ giá trị của form (Giữ nguyên)
		public string SearchString { get; set; }
		public string SelectedDepartment { get; set; }
		public string SelectedRole { get; set; }
	}
}
