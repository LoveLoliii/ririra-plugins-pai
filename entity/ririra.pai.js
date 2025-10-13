import { EntitySchema } from "typeorm";

export const Pai = new EntitySchema({
  name: "Pai", // 实体名
  tableName: "ririra_pai", // 表名
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: "increment",
    },
    gid: {
      type: String,
    },
    uid: {
      type: String,
    },
    pai: {
      type: String,
    },
    status:{
      type:Number,
    },
    find_secord:{
      type: Number
    },
    find_where: {
      type: Number
    },
    created_at: {
      type: "datetime",
      createDate: true,
    },
  },
});