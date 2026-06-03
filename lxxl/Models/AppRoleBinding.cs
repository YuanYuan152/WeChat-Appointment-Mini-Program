using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    [Table("AppRoleBinding")]
    public class AppRoleBinding
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public int AccountId { get; set; }

        [Required]
        [StringLength(50)]
        public string RoleType { get; set; } // "Patient", "Counselor", "Assistant", "Admin"

        public int? TargetId { get; set; } // Reference to T_User.ID, T_Doctor.ID, T_Admin.ID

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}