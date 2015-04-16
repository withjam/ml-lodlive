xquery version "1.0-ml";


import module namespace semmod = "http://marklogic.com/rest-api/models/semantics"
    at "/MarkLogic/rest-api/models/semantics-model.xqy";
import module namespace eput = "http://marklogic.com/rest-api/lib/endpoint-util"
    at "/MarkLogic/rest-api/lib/endpoint-util.xqy";    
    
declare option xdmp:mapping "false";

let $params  := map:map()
let $_ := for $i in xdmp:get-request-field-names() return map:put($params, $i, xdmp:get-request-field($i))
let $headers := eput:get-request-headers() 

let $result := semmod:sparql-query($headers,$params,())
let $response := semmod:results-payload($headers,$params,$result)
let $_ := xdmp:set-response-content-type($response[1])  
  
return (
  if (map:get($params, "callback")) then fn:concat(map:get($params, "callback"), "(") else (),
  $response[2],
  if (map:get($params, "callback")) then ")" else ()
  
  )