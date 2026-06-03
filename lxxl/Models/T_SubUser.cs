using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_SubUser
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "所属类型")]//1活动，赛事报名表
        public short Type { get; set; }


        [Display(Name = "所属活动")]
        [ForeignKey("ActionID")]
        public T_Action Action { get; set; }
        public string ActionID { get; set; }
        
        [Display(Name = "提交人")]
        [ForeignKey("UserID")]
        public T_User User { get; set; }

        [Display(Name = "提交人ID")]
        public long UserID { get; set; }        

        [Display(Name = "提交时间")]
        public DateTime SubTime { get; set; }

        [Display(Name = "审核")]
        public bool IsReview{ get; set; }

        [Display(Name = "是否删除")]
        public bool IsState { get; set; }

        [Display(Name = "提交内容1")]
        public string Content1 { get; set; }

        [Display(Name = "提交内容2")]
        public string Content2 { get; set; }

        public ICollection<T_SubUserData> SubFormData { get; set; }

        public T_SubUser()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.SubTime = DateTime.Now;
            this.IsReview = false;
            this.IsState = false;
        }
        public T_SubUser(string ActivitygId, long UserID, short Type = 1)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.ActionID = ActivitygId;
            this.UserID = UserID;
            this.Type = Type;
            this.SubTime = DateTime.Now;
            this.IsReview = false;
            this.IsState = false;
        }

    }
}