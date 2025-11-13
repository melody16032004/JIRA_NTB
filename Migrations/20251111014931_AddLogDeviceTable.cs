using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JIRA_NTB.Migrations
{
    /// <inheritdoc />
    public partial class AddLogDeviceTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LogDevices",
                columns: table => new
                {
                    IdLog = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    DeviceId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AppName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TimeStart = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IPV4 = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TimeEnd = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogDevices", x => x.IdLog);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LogDevices");
        }
    }
}
