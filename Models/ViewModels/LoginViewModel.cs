using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models.ViewModels
{
	public class LoginViewModel
	{
		[Required(ErrorMessage = "Vui lòng nhập Email")]
		[EmailAddress]
		public string Email { get; set; }

		[Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
		[DataType(DataType.Password)]
		public string Password { get; set; }

		[Display(Name = "Nhớ tài khoản?")]
		public bool RememberMe { get; set; }
	}
}
