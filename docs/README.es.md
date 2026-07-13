# Carpeta `docs`

Esta carpeta contiene la **documentación transversal** del monorepo: guías de arquitectura, decisiones técnicas, convenciones, procesos, y cualquier material compartido entre aplicaciones, pipelines, agentes y workflows.

- **Propósito principal**: tener un punto único para la documentación “global” del proyecto (no específica de una sola app/agente).
- **Recomendación**: organiza la documentación por temas (arquitectura, despliegue, datos, seguridad, observabilidad, etc.) y mantén enlaces desde los READMEs de cada componente hacia estas guías.


1. Base de datos y sistemas de roles y permisos, Node + PostgreSQL + Express : base sobre la que colgar los módulos. Socket.IO para el sync en ambos sistemas de cada restaurante. Se crea la API central con Postgre, autenticación JSON web token y roles para cada uno de los puestos: superadmin(yo), admin ceo/cto, RRHH, jefe de economato, director de cocina, y responsable de formación.