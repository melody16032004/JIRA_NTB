using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.Extensions.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
namespace JIRA_NTB.Services
{
	public class EmailSenderService : IEmailSender
	{
		private readonly IConfiguration _config;
		public EmailSenderService(IConfiguration config)
		{
			_config = config;
		}
		public async Task SendEmailAsync(string email, string subject, string htmlMessage)
		{
			// Lấy thông tin từ appsettings.json
			var emailSettings = _config.GetSection("EmailSettings");

			// Validate required settings
			var senderEmail = emailSettings["SenderEmail"];
			var senderName = emailSettings["SenderName"];
			var smtpServer = emailSettings["SmtpServer"];
			var smtpPort = emailSettings["SmtpPort"];
			var username = emailSettings["Username"];
			var password = emailSettings["Password"];

			if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(smtpServer) || 
			    string.IsNullOrEmpty(smtpPort) || string.IsNullOrEmpty(username) || 
			    string.IsNullOrEmpty(password))
			{
				throw new InvalidOperationException(
					"Email configuration is missing or incomplete. Please check appsettings.json 'EmailSettings' section.");
			}

			var mimeMessage = new MimeMessage();
			mimeMessage.From.Add(new MailboxAddress(
				senderName ?? "JIRA NTB",
				senderEmail
			));
			mimeMessage.To.Add(MailboxAddress.Parse(email));
			mimeMessage.Subject = subject;

			var builder = new BodyBuilder { HtmlBody = htmlMessage };
			mimeMessage.Body = builder.ToMessageBody();

			using (var client = new SmtpClient())
			{
				await client.ConnectAsync(
					smtpServer,
					int.Parse(smtpPort),
					SecureSocketOptions.StartTls // Luôn dùng bảo mật
				);

				await client.AuthenticateAsync(
					username,
					password // Đọc pass từ appsettings, không viết cứng
				);

				await client.SendAsync(mimeMessage);
				await client.DisconnectAsync(true);
			}
		}
	}
}
