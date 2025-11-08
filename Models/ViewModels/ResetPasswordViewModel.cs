using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models.ViewModels
{
	public class ResetPasswordViewModel
	{
		[Required]
		public string UserId { get; set; } // Sẽ dùng hidden field

		[Required]
		public string Token { get; set; } // Sẽ dùng hidden field

		[Required(ErrorMessage = "Vui lòng nhập mật khẩu mới")]
		[StringLength(100, ErrorMessage = "{0} phải có ít nhất {2} và tối đa {1} ký tự.", MinimumLength = 6)]
		[DataType(DataType.Password)]
		public string NewPassword { get; set; }

		[DataType(DataType.Password)]
		[Compare("NewPassword", ErrorMessage = "Mật khẩu và mật khẩu xác nhận không khớp.")]
		public string ConfirmPassword { get; set; }
	}
}
