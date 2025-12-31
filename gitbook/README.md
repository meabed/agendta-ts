# What is Agenda-TS?



<figure><img src=".gitbook/assets/Pulsecron_logo.png" alt=""><figcaption></figcaption></figure>

## **Definition and Context**:

* Agenda-TS is an open-source job scheduling tool in the Node.js ecosystem, serving as a modern TypeScript fork of the discontinued Agenda project.
* Utilizes MongoDB for managing job data, which enhances its ability to perform at scale.

## Unique Features in Agenda-TS

* **Latest MongoDB Driver Support**: Agenda-TS is fully compatible with the latest MongoDB driver, ensuring users can take advantage of the most current database features and enhancements.
* **Resume Incomplete Tasks After System Restart**: When the system restarts, Agenda-TS resumes incomplete tasks that were in progress or queued for execution, providing seamless continuation without manual intervention.
* **Retry Failed Tasks**: Agenda-TS offers retry mechanisms using exponential and fixed backoff strategies with configurable attempts, ensuring efficient retries of failed tasks without overwhelming the system.
* **Continuous Maintenance**: As an open-source project actively maintained, Agenda-TS is consistently improved, providing users with reliable updates and support.
* **Extensive Documentation**: Provides detailed guides and examples for a quick and easy start.

## **Related Projects**:

* [**agenda-ts**](https://github.com/meabed/agenda-ts): The main project repository.
* [**nestjs-agenda-ts**](https://github.com/meabed/nestjs-agenda-ts): An official NestJS module specifically tailored for integrating Agenda-TS into NestJS applications.

## **Usage and Application**:

* Ideal for developers needing a reliable, scalable, and modern job scheduling solution.
* Applicable in scenarios ranging from simple task automation to complex job orchestration in distributed systems.
