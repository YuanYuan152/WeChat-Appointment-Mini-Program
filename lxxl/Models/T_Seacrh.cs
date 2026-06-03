using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_Seacrh
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long Id { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "外部关联gId")]
        [StringLength(32)]
        public string OutgId { get; set; }

        [Display(Name = "类型")]//1.活动类型的培训 2.培训
        public short Type { get; set; }

        [Display(Name = "封面图")]
        public string faceImg { get; set; }

        [Display(Name = "关键字")]//关键字搜索
        public string Name { get; set; }

        [Display(Name = "分类")]//分类搜索
        public string ClassType { get; set; }

        [Display(Name = "跳转链接")]
        public string Url { get; set; }

        [Display(Name = "逻辑删除")]
        public bool isDelete { get; set; }

        [Display(Name = "时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]//所属平台
        public string Remark { get; set; }

        public T_Seacrh()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }
        public T_Seacrh(string faceImg,string OutgId, short Type, string Name, string ClassType, string Url,string Remark)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.faceImg = faceImg;
            this.OutgId = OutgId;
            this.Type = Type;
            this.Name = Name;
            this.ClassType = ClassType;
            this.Url = Url;
            this.Remark = Remark;
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }
    }
}