using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_Feedback
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long Id { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "反馈用户")]
        [StringLength(32)]
        public string userGId { get; set; }

        [Display(Name = "反馈内容")]
        public string Content { get; set; }

        [Display(Name = "反馈时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "删除")]
        public bool isDelete { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Feedback()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
        }

        public T_Feedback(string user_gId, string content)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.userGId = user_gId;
            this.Content = content;
        }
    }
}