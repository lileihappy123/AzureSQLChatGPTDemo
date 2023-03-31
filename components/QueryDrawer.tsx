import { Drawer } from "@mui/material";
import { head } from "lodash-es";
import { useEffect, useState } from "react";
import DataTable from "react-data-table-component";
import { toast } from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { useQueryStore } from "@/store";
import { ResponseObject } from "@/types";
import Icon from "./Icon";
import EngineIcon from "./EngineIcon";

type RawQueryResult = {
  [key: string]: any;
};

const QueryDrawer = () => {
  const queryStore = useQueryStore();
  const [rawResults, setRawResults] = useState<RawQueryResult[]>([]);
  const context = queryStore.context;
  const [statement, setStatement] = useState<string>(context?.statement || "");
  const [isLoading, setIsLoading] = useState(true);
  const columns = Object.keys(head(rawResults) || {}).map((key) => {
    return {
      name: key,
      sortable: true,
      selector: (row: RawQueryResult) => row[key],
    };
  });

  useEffect(() => {
    if (!queryStore.showDrawer) {
      return;
    }

    setStatement(context?.statement || "");
    executeStatement(context?.statement || "");
  }, [context, queryStore.showDrawer]);

  const executeStatement = async (statement: string) => {
    if (!statement) {
      toast.error("请输入一段SQL语句.");
      return;
    }

    if (!context) {
      toast.error("没有连接信息");
      setIsLoading(false);
      setRawResults([]);
      return;
    }

    setIsLoading(true);
    setRawResults([]);
    const { connection, database } = context;
    try {
      const response = await fetch("/api/connection/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection,
          db: database?.name,
          statement,
        }),
      });
      const result = (await response.json()) as ResponseObject<RawQueryResult[]>;
      if (result.message) {
        toast.error(result.message);
      } else {
        setRawResults(result.data);
      }
    } catch (error) {
      console.error(error);
      toast.error("执行失败");
    } finally {
      setIsLoading(false);
    }
  };

  const close = () => queryStore.toggleDrawer(false);

  return (
    <Drawer open={queryStore.showDrawer} anchor="right" className="w-full" onClose={close}>
      <div className="w-screen sm:w-[calc(60vw)] lg:w-[calc(50vw)] 2xl:w-[calc(40vw)] max-w-full flex flex-col justify-start items-start p-4">
        <button className="btn btn-sm btn-circle" onClick={close}>
          <Icon.IoMdClose className="w-5 h-auto" />
        </button>
        <h3 className="font-bold text-2xl mt-4">执行语句</h3>
        {!context ? (
          <div className="w-full flex flex-col justify-center items-center py-6 pt-10">
            <Icon.BiSad className="w-7 h-auto opacity-70" />
            <span className="text-sm font-mono text-gray-500 mt-2">No connection selected.</span>
          </div>
        ) : (
          <>
            <div className="w-full flex flex-row justify-start items-center mt-4">
              <span className="opacity-70">数据库连接: </span>
              <EngineIcon className="w-6 h-auto" engine={context.connection.engineType} />
              <span>{context.database?.name}</span>
            </div>
            <div className="w-full h-auto mt-4 px-2 flex flex-row justify-between items-end border rounded-lg overflow-clip">
              <TextareaAutosize
                className="w-full h-full outline-none border-none bg-transparent leading-6 pl-2 py-2 resize-none hide-scrollbar text-sm font-mono break-all"
                value={statement}
                rows={1}
                minRows={1}
                maxRows={5}
                placeholder="请输入你的查询语句.."
                onChange={(e) => setStatement(e.target.value)}
                disabled={true}
              />
              <button
                className="w-8 p-1 -translate-y-1 cursor-pointer rounded-md hover:shadow hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => executeStatement(statement)}
              >
                <Icon.IoPlay className="w-full h-auto text-indigo-600" />
              </button>
            </div>
            <div className="w-full flex flex-col justify-start items-start mt-4">
              {isLoading ? (
                <div className="w-full flex flex-col justify-center items-center py-6 pt-10">
                  <Icon.BiLoaderAlt className="w-7 h-auto opacity-70 animate-spin" />
                  <span className="text-sm font-mono text-gray-500 mt-2">执行中</span>
                </div>
              ) : rawResults.length === 0 ? (
                <div className="w-full flex flex-col justify-center items-center py-6 pt-10">
                  <Icon.BsBox2 className="w-7 h-auto opacity-70" />
                  <span className="text-sm font-mono text-gray-500 mt-2">无数据返回</span>
                </div>
              ) : (
                <div className="w-full">
                  <DataTable className="w-full border !rounded-lg" columns={columns} data={rawResults} fixedHeader pagination responsive />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};

export default QueryDrawer;
