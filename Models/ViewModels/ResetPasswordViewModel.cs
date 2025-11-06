using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models.ViewModels
{
	public class ResetPasswordViewModel
	{
		[Required]
		[EmailAddress]
		public string Email { get; set; }

		[Required]
		public string Token { get; set; }

		[Required(ErrorMessage = "Vui lòng nhập mật khẩu mới")]
		[DataType(DataType.Password)]
		[Display(Name = "Mật khẩu mới")]
		[StringLength(100, ErrorMessage = "{0} phải có ít nhất {2} ký tự.", MinimumLength = 6)]
		public string Password { get; set; }

		[DataType(DataType.Password)]
		[Display(Name = "Xác nhận mật khẩu")]
		[Compare("Password", ErrorMessage = "Mật khẩu và mật khẩu xác nhận không khớp.")]
		public string ConfirmPassword { get; set; }
	}
}
