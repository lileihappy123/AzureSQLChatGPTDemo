import axios from "axios";
import { useEffect, useState } from "react";
import Icon from "./Icon";

interface Props {
  className?: string;
}

const GitHubStarBadge = (props: Props) => {
  const { className } = props;
  const [stars, setStars] = useState(0);
  const [isRequesting, setIsRequesting] = useState(true);

  useEffect(() => {
    const getRepoStarCount = async () => {
      let starCount = 0;
      try {
        const { data } = await axios.get(`https://api.github.com/repos/bytebase/sqlchat`, {
          headers: {
            Accept: "application/vnd.github.v3.star+json",
            Authorization: "",
          },
        });
        starCount = data.stargazers_count as number;
      } catch (error) {
        // do nth
      }

      setStars(starCount);
      setIsRequesting(false);
    };

    getRepoStarCount();
  }, []);

  return (
    <a
      className={`${
        className || ""
      } border rounded flex flex-row justify-start items-center text-black text-xs bg-white shadow-inner overflow-clip hover:opacity-80`}
      href="https://github.com/richardeee/AzureSQLChatDemo"
      target="_blank"
      aria-label="Azure SQL Chat Demo"
    >
      <span className="pr-1 pl-1.5 py-0.5 h-full flex flex-row justify-center items-center bg-gray-100 border-r font-medium">
        <Icon.IoLogoGithub className="w-4 h-auto mr-0.5" />
        <span className="mt-px">Github Repo</span>
      </span>
    </a>
  );
};

export default GitHubStarBadge;
