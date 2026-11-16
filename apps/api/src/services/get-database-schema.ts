import { notion } from "@/integrations/notion/client";

export async function getDatabaseSchema(databaseId: string) {
  const db = await notion.databases.retrieve({ database_id: databaseId });

  if (!("data_sources" in db)) {
    throw new Error(
      "O Notion retornou o database de forma parcial (sem data sources).",
    );
  }

  const dataSources = await Promise.all(
    db.data_sources.map(async ({ id, name }) => {
      const ds = await notion.dataSources.retrieve({ data_source_id: id });

      const properties =
        "properties" in ds
          ? Object.entries(ds.properties).map(([propName, prop]) => ({
              id: prop.id,
              name: propName,
              type: prop.type,
              ...(prop.type === "relation" && {
                relation: {
                  databaseId: prop.relation.database_id,
                  dataSourceId: prop.relation.data_source_id,
                  ...("dual_property" in prop.relation
                    ? {
                        type: "dual_property" as const,
                        syncedPropertyName:
                          prop.relation.dual_property.synced_property_name,
                      }
                    : { type: "single_property" as const }),
                },
              }),
            }))
          : [];

      return { id, name, properties };
    }),
  );

  return { databaseId, dataSources };
}
