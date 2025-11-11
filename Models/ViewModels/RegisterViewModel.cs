using Microsoft.AspNetCore.Mvc.Rendering;
using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models.ViewModels
{
	public class RegisterViewModel
	{
		[Required(ErrorMessage = "Vui lòng chọn phòng ban")]
		[Display(Name = "Phòng ban")]
		public string DepartmentId { get; set; }

		// Thuộc tính này để truyền danh sách phòng ban từ Controller sang View
		public IEnumerable<SelectListItem>? DepartmentList { get; set; }

		[Required(ErrorMessage = "Vui lòng nhập tên đầy đủ")]
		[Display(Name = "FullName")]
		public string FullName { get; set; }

		[Required(ErrorMessage = "Vui lòng nhập Email")]
		[EmailAddress]
		[Display(Name = "Email")]
		[RegularExpression(@"^[a-zA-Z0-9._%+-]+@gmail\.com$", ErrorMessage = "Email phải có định dạng example@gmail.com")]
		public string Email { get; set; }

		[Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
		[DataType(DataType.Password)]
		[Display(Name = "Mật khẩu")]
		public string Password { get; set; }

		[DataType(DataType.Password)]
		[Display(Name = "Xác nhận mật khẩu")]
		[Compare("Password", ErrorMessage = "Mật khẩu và mật khẩu xác nhận không khớp.")]
		public string ConfirmPassword { get; set; }

		public string? DeviceAddress { get; set; }
	}
}
