using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Option
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "所属表单项")]
        [ForeignKey("ItemID")]
        public T_Item Item { get; set; }
        public long ItemID { get; set; }

        [Display(Name = "排序")]
        public int Order { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

        [Display(Name = "是否可自定义")]
        public bool IsCustom { get; set; }

        [Display(Name = "自定义内容")]
        public string Custom { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "备注 ")]
        public string Remark { get; set; }

        [Display(Name = "推荐项目 ")]
        public string RecommendPro { get; set; }

        public T_Option()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.IsCustom = true;
        }

        public T_Option(long ItemgId, int Order, string Name=null, bool IsCustom=true)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.ItemID = ItemgId;
            this.Order = Order;
            this.Name = Name;
            this.IsCustom = IsCustom;
        }

        #region 获取选择该选项的总人数
        public int GetUserCount()
        {
            TMLSContext db = new TMLSContext();
            int SubCount = db.T_SubUserData.Where(o => o.OptionID == this.ID).Count();
            return SubCount;
        }
        #endregion

    }
}