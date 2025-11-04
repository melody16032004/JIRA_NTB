namespace JIRA_NTB.Services
{
	public interface IEmailSender
	{
		Task SendEmailAsync(string toEmail, string subject, string htmlMessage);
	}
}
