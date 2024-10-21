import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const API_page = () => (
  <div className="px-4 lg:px-20 ubuntu-light">
    <SwaggerUI url="/swagger-api-doc.json" />
  </div>
);

export default API_page;
