using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_ExamC
    {
        public long ID { get; set; }
        
        public string Name { get; set; }

        public T_ExamC(long ID, string Name)
        {
            this.ID = ID;
            this.Name = Name;
        }
       
    }
}