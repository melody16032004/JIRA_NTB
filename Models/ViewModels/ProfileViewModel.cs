using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models.ViewModels
{
	public class ProfileViewModel
	{
		// Thông tin chỉ để hiển thị (không cho sửa)
		[Display(Name = "Email")]
		public string Email { get; set; }

		[Display(Name = "Phòng ban")]
		public string DepartmentName { get; set; }

		// Thông tin cho phép chỉnh sửa
		[Display(Name = "Họ và tên")]
		public string? FullName { get; set; }

		[Display(Name = "Ngày sinh")]
		[DataType(DataType.Date)]
		public DateTime? Dob { get; set; }

		[Display(Name = "Giới tính")]
		[MaxLength(10)]
		public string? Gender { get; set; }

		// Dùng để hiển thị ảnh đại diện hiện tại (nếu có)
		public string? CurrentAvatarPath { get; set; }

		// Dùng để tải lên ảnh mới (tùy chọn)
		[Display(Name = "Đổi ảnh đại diện")]
		public IFormFile? NewAvatar { get; set; }
	}
}
