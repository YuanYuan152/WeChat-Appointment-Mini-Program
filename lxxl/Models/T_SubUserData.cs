using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_SubUserData
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "所属提交")]
        [ForeignKey("SubUserID")]
        public T_SubUser SubUser { get; set; }
        public long SubUserID { get; set; }

        [Display(Name = "所属选项")]
        [ForeignKey("OptionID")]
        public T_Option Option { get; set; }
        public long OptionID { get; set; }

        [Display(Name = "提交内容")]
        public string Content { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "备注")]//当前报名选项
        public string Remark { get; set; }

        public T_SubUserData()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
        }
        public T_SubUserData(long SubUsergId, long OptiongId, string content, string Remark)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.SubUserID = SubUsergId;
            this.OptionID = OptiongId;
            this.Content = content;
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
            this.Remark = Remark;
        }
    }
}