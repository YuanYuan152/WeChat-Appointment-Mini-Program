using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_Action
    {
        [Key]
        public string ID { get; set; }

        [Display(Name = "活动名称")]
        public string Name { get; set; }

        [Display(Name = "活动报名表")]
        public string FormID { get; set; }

        //新增字段//
        [Display(Name = "举办单位")]
        public string CompanyName { get; set; }

        [Display(Name = "联系人")]
        public string ContactName { get; set; }

        [Display(Name = "联系电话")]
        public string Tel { get; set; }

        [Display(Name = "活动场地")]
        public string Place { get; set; }

        [Display(Name = "活动开始时间")]
        public DateTime StateTime { get; set; }

        [Display(Name = "活动结束时间")]
        public DateTime EndTime { get; set; }

        [Display(Name = "活动内容")]
        public string Content { get; set; }

        [Display(Name = "报名开始时间")]
        public DateTime StateSignTime { get; set; }

        [Display(Name = "报名截止时间")]
        public DateTime EndSignTime { get; set; }

        [Display(Name = "人数上限")]
        public int Number { get; set; }

        [Display(Name = "已报名人数")]
        public int SignNumber { get; set; }

        [Display(Name = "宣传图片")]
        public string Img { get; set; }

        [Display(Name = "活动简介")]
        public string Info { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }
        public ICollection<T_SubUser> SubUser { get; set; }
        public T_Action()
        {
            this.ID = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.SignNumber = 0;
        }

        public T_Action(string name, string info, string FormID)
        {
            this.ID = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.Name = name;
            this.Info = info;
            this.FormID = FormID;
            this.SignNumber = 0;
        }

        public T_Form GetForm()
        {
            TMLSContext db = new TMLSContext();
            T_Form Form = db.T_Form.Where(o => o.gId == this.FormID && !o.IsDelete).FirstOrDefault();
            return Form;
        }
    }
}
