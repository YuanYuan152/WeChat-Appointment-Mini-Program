using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{

    public class T_OrderItem
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long Id { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "关联订单gid")]
        [StringLength(32)]
        public string order_gId { get; set; }

        [Display(Name = "咨询师gid")]
        [StringLength(32)]
        public string doctorgId { get; set; }

        [Display(Name = "咨询师日程gid")]
        [StringLength(32)]
        public string doctorSchedulegId { get; set; }

        [Display(Name = "价格")]
        public double price { get; set; }

        [Display(Name = "开始时间")]
        public DateTime startTime { get; set; }

        [Display(Name = "截止时间")]
        public DateTime endTime { get; set; }
                
        [Display(Name = "实际使用时间")]
        public DateTime useTime { get; set; }

        [Display(Name = "删除")]
        public bool isDelete { get; set; }

        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_OrderItem()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.price = 0;
        }
        public T_OrderItem(string order_gId, string doctorgId,string doctorSchedulegId, DateTime startTime, DateTime endTime, double price = 0)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.order_gId = order_gId;
            this.doctorgId = doctorgId;
            this.doctorSchedulegId = doctorSchedulegId;
            this.startTime = startTime;
            this.endTime = endTime;
            this.price = price;
        }
    }
}
