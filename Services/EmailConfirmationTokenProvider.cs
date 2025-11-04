using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace JIRA_NTB.Services
{
	/// Custom token provider chỉ dành cho email confirmation với thời hạn 10 phút
	public class EmailConfirmationTokenProvider<TUser> : DataProtectorTokenProvider<TUser> where TUser : class
	{
		public EmailConfirmationTokenProvider(
			IDataProtectionProvider dataProtectionProvider,
			IOptions<EmailConfirmationTokenProviderOptions> options,
			ILogger<DataProtectorTokenProvider<TUser>> logger)
			: base(dataProtectionProvider, options, logger)
		{
		}
	}

	public class EmailConfirmationTokenProviderOptions : DataProtectionTokenProviderOptions
	{
		public EmailConfirmationTokenProviderOptions()
		{
			Name = "EmailConfirmationTokenProvider";
			TokenLifespan = TimeSpan.FromMinutes(10); // Chỉ 10 phút cho email confirmation
		}
	}
}
