# PAWSsion-Pet-Adoption-and-Welfare-System
TEAM HONEYGOLD S/Y 2026-2027


matchmaking.html → Interface ng user.
matchmaking.js → Nagpapadala ng request.
routes/matchmaking.js → Tumatanggap ng request.
matchmakingController.js → Nagpo-process at kumokonekta sa FastAPI.
main.py → Entry point ng FastAPI.
matchmaking.py → Matchmaking algorithm.
recommendation.py → Recommendation logic.
requirements.txt → Listahan ng Python packages na kailangan para gumana ang FastAPI.

tailwind install 
1. npm install -D tailwindcss@3
npx tailwindcss init
2. npx tailwindcss -i ./public/assets/css/input.css -o ./public/assets/css/tailwind.css --watch
3. npm install multer for uploading files
4. working admin side email: admin@pawpon.com || password: admin@pawpon.com || org and user accounts: use email for password
password for pup org: PupSintang_08@
5. add sessions for each user (not yet started)
6. Pa add nalang sa database nito 
ALTER TABLE accounts
ADD COLUMN last_login DATETIME NULL
AFTER updated_at;
7. pa add nalang sa database nito for modify nung action sa status ng mga usermanagement
ALTER TABLE accounts 
MODIFY COLUMN status ENUM('pending', 'active', 'disabled', 'suspended', 'banned', 'rejected') DEFAULT 'active';
8. Import nyo na lang yung bagong database, may nabago doon
9. kapag may bagong page sa org na need iclick yung logout, iadd na lang to sa dulo ng html bago mag </body> tag:
# **9. TO DO (07.19.26)**
## **LOGIN**
✓ forgot password


## **ALL MODULES**
- **Session handling**
  - Prevent unauthorized access to protected pages
  - Redirect unauthenticated users to login
  - Destroy session on logout
- **Make pages responsive**

---

## **USERSIDE MODULES**
✓ Use **Title** and **Subtitle** for headers/topbar
- Notification
✓ Connect **Dashboard**,
- **My Application** and **Kamustahan** to DB
✓ Connect **Matchmaking**, **Donation**
- Improve CSS

---

## **ORG MODULES**
✓ Use **Title** and **Subtitle** for headers/topbar
- Notification
✓ Search, CRUD
✓ Connect **Dashboard**, **Application**,**Donation** 
- Connect **Kamustahan**, **Analytics**, and **Organization Profile** to DB
- Settings & 
✓ Support
✓ **Analytics**
- Improve CSS

---

## **ADMIN MODULES**
- Notification
- Search, CRUD
- Connect **Dashboard**,  **Feedback**, **Account Actions** to DB
- Connect Org Details to db
- Settings
- Improve CSS

---

## **CODE**
- Clean unnecessary whitespaces, redundant/unused codes
- Separate HTML, CSS, and JavaScript properly
- Check for hard-coded lines
- Add comments where necessary *(for easy debugging)*

---
# 10. TARGET DEPLOYMENT??
 *pa add kung ano pa gagawin dito*

# 11.
paimport na lang ng user_adoption_applications table sa db nyo

# 12. 
Pa update na lang ng db, palagay netong command:

ALTER TABLE user_adoption_applications ADD COLUMN decline_reason TEXT NULL AFTER status;

ALTER TABLE user_adoption_applications
ADD COLUMN interview_date DATE NULL,
ADD COLUMN interview_time VARCHAR(50) NULL,
ADD COLUMN interview_method ENUM('onsite', 'virtual') DEFAULT 'virtual',
ADD COLUMN interview_location_link TEXT NULL;

# August 4, 2026

# Paimport na lang ng user_adoption_applications sa db nyo may nabago lang doon


# Mga need pa ayusin:

Not working:

CREATE AN ACCOUNT:

    Lagyan ng scroll bar

USER SIDE:

Dashboard:
	
	✓ Make it Real-time!
	✓ Quick Actions: Upcoming Interview
	✓ Recent Activities
	✓ Upcoming Schedule

    ✓ kapag lagpas na sa interview datesa dashboard, mawawala na sa upcoming schedule while sa application page naman, yung nilalgyan ng request schedule is mawawala mapapalitan ng interview done | awaiting org decision

Notification:

	Dapat nakikita ang lahat ng changes sa notif and dapat sa sidebar is kapag may changes may pula na bilog na nagaappear

    Under My Application:
        Dapat kapag may bagong update is may notif like parang read or unread sa may under review, interview sched, pending, declined

Profile: -- ok na ( Jhy ) - pa check nalang
	
	Dapat nakikita yung picture sa lahat ng page, Hindi lang profile nakalagay hindi pa gumagana sa dashboard, kamustahan, donations, profile, matchmaking pages

My Application: 

	✓ Ayusin sa Adoption Applications under view
	✓ Dapat nakikita yung mga info sa application pati na din ang interview schedule
	✓ Ayusin yung sa may number

    ✓ Dapat kapagg nag resched ang org nanotif doon sa application ng user

	✓ What if, once na yung applicaiton is under interview schedule is pwedeng magrequest ang adopter to change date once na hindi sila available
    
	✓ kapag nadecline sa view details dapat may reapply button if gusto pang mag apply yung user sa same pet na yun

    ✓ sa reschedule approved na lumalabas lang kapag nagrequest

    dapat once na adopted na yung pet pero yung isang user is may under review, dapat maging declined na yun since naadopt na ng isang user ang pet

    Once na approved na dapat may inotify pa ang user kung kelan makukuha ang pet 

    ✓ fixed date and time
Adoption-hub: 	
	
	✓ Once na adopted na yung pet is hindi na sya makikita ng ibang user sa adoption page

    ✓ Kapag nadecline, kapag pinag view yung details is nakalagay doon is decline view details kung   bakit nadecline then mapupunta doon sa applications

    ✓ may bug kapag binubuksan ang reason kapag declined

Notes: 
Mga ned iconfirm kay jhy: donation side, profile yung sa pagchange ng pass, kamustahan

ORGANIZATION:

Pets: 
	✓ Sa available, makikita pa din yung all status, all species and add pet
	✓ Sa adopted, dapat makikita pa din yung all species
	✓ Sa Add new pet, alisin yung archive sa adoption status
    ✓ alisin din ang archive sa all; status
    ✓ ilipat ang archive sa sarili; nyang button
    ✓ Sa add new pet, kapag pinili ang adopted satus dapat may lilitaw na additional form for adopters information
	✓ Sa view Profile, alisin ang birth date, date sa medical history
    ✓ Edit Record may bug pet_desciption = behavior_description
	✓ Iseparate ang available sa adopted para hindi malito ang orgs
	Iseparate ang archive pero tignan sa controller dapat gumagana pa din yung ibang functions
	✓ Dapat once na adopted is wala ng edit, archive and delete buttons instead dapat may view adoption applications button na mapupunta doon sa adoption application details
	✓ Once available may archive, edit & delete buttons
    ✓ Under add pet, sa may adoption status dapat once na adopted auto na malalgay sa adopted pets, and yung available and pending is sa active status
    ✓ Archive is may unarchive buttons and nakahide ang edit, delete buttons
    Once na approved na dapat may inotify pa ang user kung kelan makukuha ang pet 
# Questions and Testing

    Under add pet, itanong if magkaiba ang pet description at personality & traits since pwede naman mailagay ang personality & traits sa pet description??

    Itry ni mayie mag edit, delete, at add pet if nagpafunction pa

Adoption:
	✓ Export Summary
	✓ lagyan ng edit schedule ang application details
    ✓ kapag nagrequest ang adopter ng resched of interview dapat makikita ng org
    ✓ kapag decline, instead of idisable ang declined button dapat auto na napapalitan ng view declined details
    ✓ Under Interview nschedule, yung date is hindi tugma doon sa napiliing date, ang inistore is yung kung kailan ka nag sched ng interview
    ✓ ayusing yung sa applicant name diba yung org naglagay ng add pet na adopted dapat lumabas doon yuyng name ng nagadopt
    ✓ fixed date and time

Settings & Support:
	
	Hindi pa final

Notification:

	Dapat nakikita ang lahat ng changes sa notif and dapat sa sidebar is kapag may changes may pula na bilog na nagaappear
	
NOTES:
✓ Itanong kay jhy if ok na yung kamustahan

ADMIN:

Di ko pa navivisit

	
# I run nyo to sa db:

ALTER TABLE user_adoption_applications 
MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Under Review';

# install this in project folder
npm install nodemailer
# Aug 08, 2026
Import nyo na lang yung user adoption applicationsn table may additional columns don

# Pa run sa db: (Aug 09, 2026)
CREATE TABLE IF NOT EXISTS `application_interviews` (
  `interview_id` INT(11) NOT NULL AUTO_INCREMENT,
  `application_id` INT(11) NOT NULL,
  `interview_date` DATE DEFAULT NULL,
  `interview_time` TIME DEFAULT NULL,
  `interview_method` VARCHAR(50) DEFAULT NULL,
  `interview_location_link` TEXT DEFAULT NULL,
  `requested_interview_date` DATE DEFAULT NULL,
  `requested_interview_time` TIME DEFAULT NULL,
  `reschedule_reason` TEXT DEFAULT NULL,
  `resched_status` VARCHAR(50) DEFAULT 'None',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`interview_id`),
  UNIQUE KEY `unique_app_interview` (`application_id`),
  CONSTRAINT `fk_interview_application` FOREIGN KEY (`application_id`) REFERENCES `user_adoption_applications` (`application_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `application_interviews` (
  `application_id`,
  `interview_date`,
  `interview_time`,
  `interview_method`,
  `interview_location_link`,
  `requested_interview_date`,
  `requested_interview_time`,
  `reschedule_reason`,
  `resched_status`
)
SELECT 
  `application_id`,
  `interview_date`,
  `interview_time`,
  `interview_method`,
  `interview_location_link`,
  `requested_interview_date`,
  `requested_interview_time`,
  `reschedule_reason`,
  `resched_status`
FROM `user_adoption_applications`
WHERE `interview_date` IS NOT NULL 
   OR `requested_interview_date` IS NOT NULL 
   OR `resched_status` != 'None';

ALTER TABLE `user_adoption_applications`
  DROP COLUMN `interview_date`,
  DROP COLUMN `interview_time`,
  DROP COLUMN `interview_method`,
  DROP COLUMN `interview_location_link`,
  DROP COLUMN `requested_interview_date`,
  DROP COLUMN `requested_interview_time`,
  DROP COLUMN `reschedule_reason`,
  DROP COLUMN `resched_status`;


  # Palagay sa db nyo
  ALTER TABLE animals DROP COLUMN birth_date;
  
  # Palagay sa db ny:o Aug 14 (today)
  ALTER TABLE user_adoption_applications 
    MODIFY COLUMN adopter_id INT NULL;


# AUG 19, 2026

# new folder under public: ✓
    folder data - for storing the addresses

# MGA NABAGO SA DB ✓
    adopters table
    organizations table

# mga files na may changes: ✓
    Authcontroller
    assets/css/create_account
    auth/create-account.html
    read.me
    assets/css/organization_signup
    auth/organization_signup.html

# MGA nafix
    Create account (adopter):
        may sanitation na ang birthday, below 18 cannot be an adopter
        may sanitations na doon sa mga address, zip code
    Create account (organization):
        css ng org



# new acc:

irespeleta@my.cspc.edu.ph pass: irespeleta@my.cspc.edu.ph2A
eneriatelpse@gmail.com pass: 1Eneriatelepse@gmail.com

# new functions na need iupdate:

user profile
org profile


sa edit user profile:  ✓

dapat kung paano yung sa create an account ganun din ang nasa edit ✓


account type palitan ng role ✓

remove the account type ✓

sa profile: ✓
makikita ng user are:
birthday
civil status (if meron, else if = none, hide the civil status)
occupation
full address

kapag nasa edit profile na:  ✓

First Name
Last Name
Email
Mobile Number
Birthday
Civil Status
Occupation
Street Address
Barangay
City / Municipality
Province
Region
ZIP Code

user side:

    adoption hub : ✓
        prefilled pero pwede naman iedit dapat yung sa name, wag daw ang age, birthday na lang or through bday macocompute na ang age
 
# AUG 21, 2026 ✓
ALTER TABLE animals
DROP COLUMN color,
DROP COLUMN personality_tags;

# Aug 21, 2026 (5 am)

ALTER TABLE user_adoption_applications
-- 1. Idagdag ang JSON column para sa snapshot
ADD COLUMN applicant_snapshot JSON AFTER adopter_id,

-- 2. Tatanggalin ang mga redundant user profile columns
DROP COLUMN full_name,
DROP COLUMN contact_number,
DROP COLUMN email,
DROP COLUMN full_address,
DROP COLUMN civil_status,
DROP COLUMN age,
DROP COLUMN occupation;

# may bugs pa sa dashboard:

kapag nainterview sched at nadecline then nag re apply ulit, nakikita sa dashboard recent activities na interview scheduled kahit under review pa naman  ✓

sa org naman kahit under review after ng decline, hindi naerase ang dating interview sched ✓

# important notes:

pagsamahin ang sa adoptionHub.html & yung sa vcalude ai na nasa cspc acc ✓

Added view profile organization ✓

# itest tom (Aug 23, 2026 8 am):

pag enable na ang decline, ideclined ang adoption then try to re-apply and check if the address 
is match with the address in the user profile ✓

Tignan if yung view profile organization will appear in under review, approved, declined or cancelled  ✓

# gawin ang nasa org profile tom (Aug 26, 2026)

HOW TO RUN WITH WORKING MATCHMAKING FEATURE
- import new db (7.23)
- create .venv first inside flask-api
    *terminal: cd flask-api then python -m venv .venv
             : .venv\Scripts\activate
             :.venv\Scripts\Activate.ps1
- install requrements
    *terminal: pip install -r requirements.txt
             : pip install -r requirements.txt
             : python -m pip install flask sentence-transformers torch scikit-learn python-dotenv
- run Flask API
    *terminal: python app.py (keep this running on venv)
- run Node.js
    *terminal: node server.js (this should be in new terminal)

# mga need pa ayusin

- apply security

- notifications sa sidebar

# Optional fixed (user & org side):
- kapag ban or suspended may days limit??

- sa mga description dapat hindi nalalagyan ng nonsense na text sa mga reason especially sa application 

- when banning/disabled an account it should have a warning first from the user
and if kaya is dapat may message sa gmail ng user na yung account nya has violated the policy or something

- (user & org side) much better if may parang pagpipilian ang org at user na ilalagay na message ara hindi makasubmit ng nonsense na text

# done na ayusin: 
- lagyan ng parang lipatan sa baba ng feedback and contact in admin ✓

- sa admin kapag nasa partner requests nagiging active na sa user management kahit hindi pa naman inaaproved ng admin ✓

- contact us (landing page footer gawing dynamic) with email sender ✓ 

- ayusin ang nasa url dapat walang .html na makikita doon (create accounts) ✓

- ayusin ang nasa url dapat walang .html na makikita doon (login) ✓

- yung receipt sa donation try to naiscan na sya  ✓

- login lockout too  many attempts (15 mins.) ✓

- notification (user, org, & admin side) ✓

- ayusin ang nasa url dapat walang .html na makikita doon (admin) ✓

- fix the user management in admin whehn suspending or banning the user or org, send the adminRoutes.js ✓

- Delete notification button ✓

- when the org deactivate the account, the account can still login pero dapat hindi na eh ✓

- sa notification dapat nakikita na yung feedback is naresolved na (pets org)  ✓

 - yung feedback ng admin to org gawing non clickable (notification) ✓

- add admin logout modal ✓

- when the org deactivate the account, the account can still login pero dapat hindi na eh ✓

# donation info (org)
sa complete address under inkind it should be auto filled based on the org's profile ✓

tanungin kay jhy bakit need pa ng account name if nakakasubmit kahit wala yun? then pagdating sa organization is nakikita yung donor name (from profile) which is parang walang silbi yung account name ✓

# donation (user)
sa cash and inkind donation dapat active pa din yung blue highlight sa donation tab sa sidebar ✓

ayusing ang swal error sa pagkasave changes kapag walang input ang account name (org) ✓

kulang pa ng validations and sanitations sa quantity sa inkind donations (user) ✓

kapag wala pang info na nilagay ang user about donation is hindi muna sya lalabas sa donation ng user since hindi pa yun ready for donation. same with showing payment method ✓

tanungin kay jhy bakit need pa ng account name if nakakasubmit kahit wala yun? then pagdating sa organization is nakikita yung donor name (from profile) which is parang walang silbi yung account name ✓

- fixed also the UI in the admin profile, and make sure that when editing a profile or password, it is safe ✓

- magtest na muna ng new password sa user, and org ✓

- addition sa profile, kapag naka 3 wrong attempts (user) ✓

- sa cash and inkind donation dapat active pa din yung blue highlight sa donation tab sa sidebar (user) ✓
- in pending ng org (after logging in), hindi nakiclick ang hamburger sidebar, logout kapag nakamaliit yung web browser ✓

- feedback ✓

-  nadedetect ang user and org logging in, attempts for security purposes (logs admin) ✓

- blocked attempts logged suspended,banneda, disabled (e.g. "a suspended user tried to log in") ✓

- Org Profile: 
    ✓ sanitation & validation of contact number
    ✓ May problem pa sa pagkuha ng profile sa mismong dashboard hindi nareread ng maayos if ibang org

- Pets (org):
    ✓ sa contact number nasa loob na sila ng snapshot baka hindi mo nabago

- Fix the UI must be responsive (dashboard profile) ✓

- If naka 3 reschedule na or yung reason is hindi valid, automatic na syang madedecline ✓

- sa org maglagay ng trash bin ✓

- ayusin ang support sa org side yung may user guide ✓

Admin side:

-sa pag archive and resolve ng feedback ng user dapat may confirmation modal (admin side) eto ang ayusin kapag ok na si claude  ✓

-sa contact support ng org and user, dapat maging dynamic sya ✓

- admin maglagay ng logs: ✓

    org:
    adoption
    donation
    kamustahan or pets?

    user:
    adoption
    donation
    kamustahan?

- user guide dynamic in the admin ✓

- feedback maglagay ng sort or filter dropdown ✓

- display rating ng users ✓

- kapag pinagdelete nakikita pa din ng user ang pets detailed kahit deleted na (org & user) ✓

- may validations and sanitations sa numbers sa donations (org) ✓

- yung pending pa ang org is hindi nakikita sa logs na naglogin sya (admin & org) ✓

# RUN THIS IN THE DB, MAKE SURE TO IMPORT THE application_interview TABLE IN THE DB BEFORE DOING THIS (AUG 29, 2026):

ALTER TABLE user_adoption_applications
    MODIFY COLUMN document_path VARCHAR(255) NULL;

ALTER TABLE user_adoption_applications
    MODIFY COLUMN adoption_intent TEXT NULL;

# add this in the db:

CREATE TABLE organization_availability (
    availability_id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    day_of_week TINYINT NOT NULL, -- 0 = Sunday ... 6 = Saturday
    is_open TINYINT(1) NOT NULL DEFAULT 1,
    start_time TIME NOT NULL DEFAULT '08:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    UNIQUE KEY uniq_org_day (organization_id, day_of_week),
    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);

ALTER TABLE organization_availability 
MODIFY COLUMN end_time TIME NOT NULL DEFAULT '21:00:00';

# add this for feedback

CREATE TABLE feedback (
    feedback_id     INT AUTO_INCREMENT PRIMARY KEY,
    account_id      INT NOT NULL,
    organization_id INT NULL,
    submitted_by    ENUM('organization', 'user') NOT NULL,
    feedback_type   ENUM('bug', 'suggestion', 'general', 'other') NOT NULL,
    subject         VARCHAR(150) NOT NULL,
    message         TEXT NOT NULL,
    rating          TINYINT NULL,
    status          ENUM('New', 'In Review', 'Resolved') NOT NULL DEFAULT 'New',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_feedback_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
        ON DELETE CASCADE
);

ALTER TABLE feedback
    MODIFY COLUMN status ENUM('pending', 'resolved', 'archived') NOT NULL DEFAULT 'pending';

ALTER TABLE feedback
    ADD COLUMN previous_status ENUM('pending', 'resolved') NULL DEFAULT NULL AFTER status;

ALTER TABLE feedback MODIFY COLUMN feedback_type VARCHAR(50) NOT NULL;

UPDATE feedback SET feedback_type = 'Report a Bug'      WHERE feedback_type = 'bug';
UPDATE feedback SET feedback_type = 'Feature Suggestion' WHERE feedback_type = 'suggestion';
UPDATE feedback SET feedback_type = 'General Feedback'   WHERE feedback_type = 'general';
UPDATE feedback SET feedback_type = 'Other'               WHERE feedback_type = 'other';

# admin settings 

CREATE TABLE site_settings (
    setting_key   VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO site_settings (setting_key, setting_value) VALUES
    ('support_email', 'pawssion_admin@gmail.com'),
    ('support_phone', '(+63) 951 450 1937'),
    ('support_hours_days', 'Monday – Friday'),
    ('support_hours_time', '8:00 AM – 5:00 PM');

# recycle bin (org side)

ALTER TABLE animals ADD COLUMN deleted_at DATETIME DEFAULT NULL;

# User guide dynamic (admin)

CREATE TABLE guide_sections (
    section_id     INT AUTO_INCREMENT PRIMARY KEY,
    audience       VARCHAR(20) NOT NULL DEFAULT 'organization',
    title          VARCHAR(150) NOT NULL,
    badge_color    VARCHAR(20) NOT NULL DEFAULT 'blue',
    bullets        TEXT NOT NULL,
    display_order  INT NOT NULL DEFAULT 0
);

INSERT INTO guide_sections (audience, title, badge_color, bullets, display_order) VALUES
('organization', 'Managing Pets & Profiles', 'blue',
'**Adding Pets:** Navigate to the Pets module, click "Add Pet", fill out required details (name, breed, age), and upload clear pictures.
**Adoption Status:** Update the status regularly (Available, Pending, or Adopted) so adopters see accurate information.
**Archiving:** Use the archive option for pets that are no longer active on the listing to keep your workspace clean.', 1),

('organization', 'Reviewing Adoption Requests', 'emerald',
'Check incoming applications submitted by potential adopters through the Adoptions tab.
Verify adopter information and match scores provided by the system.
Approve or reject applications based on your organization''s shelter screening standards.', 2),

('organization', 'Donations & Organization Profile', 'amber',
'**Donations:** Monitor records and ensure your organization''s payment methods or drop-off instructions are updated.
**Profile Settings:** Keep your shelter''s contact number, address, and description accurate so donors and adopters can reach you easily.', 3);

# admin logs
CREATE TABLE activity_logs (
    log_id       INT AUTO_INCREMENT PRIMARY KEY,
    account_id   INT NOT NULL,
    action       VARCHAR(100) NOT NULL,
    target_type  VARCHAR(50) NOT NULL,
    target_id    VARCHAR(50) NULL,
    details      VARCHAR(255) NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        ON DELETE CASCADE
);

ALTER TABLE activity_logs MODIFY COLUMN account_id INT NULL;

# accounts login attempts for admin only:

ALTER TABLE accounts ADD COLUMN profile_verify_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN profile_verify_locked_until TIMESTAMP NULL DEFAULT NULL;

#  ORG drop off inkind donation
CREATE TABLE organization_dropoff_hours (
    organization_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    is_open TINYINT(1) NOT NULL DEFAULT 1,
    start_time TIME NOT NULL DEFAULT '08:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    PRIMARY KEY (organization_id, day_of_week),
    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);

# ACTIVITY LOGS (yung narerecord sa admin):

- User side:
    Submit an adoption application
    Re-submit after a declined application
    Cancel an application
    Submit a cash donation
    Submit an in-kind donation
    Submit a Kamustahan update

- Org Side:
    Add a pet
    Edit a pet
    Delete a pet
    Archive a pet
    Approve/reject a cash donation
    Approve/reject an in-kind donation

    Added logs but not tested yet:
        - scheduled/ recheduled and approved, declined adoption application

    -  nadedetect ang user and org logging in, attempts for security purposes (logs admin) ✓

- blocked attempts logged suspended,banneda, disabled (e.g. "a suspended user tried to log in") ✓

- Admin:
    Resolve/unresolve/archive/unarchive feedback (hindi pa to natetest)
    Create/edit/delete/restore/purge/reorder a guide section
    Update site contact info (hindi pa to natetest)
    Suspend/ban a user (hindi pa to natetest)
    Approve/reject an organization (hindi pa to natetest)
    Update own admin profile (hindi pa to natetest)

    the email na doesn't exist is nalalagay sa logs ✓

# notifications:
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id       INT NOT NULL,
    title            VARCHAR(150) NOT NULL,
    message          VARCHAR(255) NOT NULL,
    type             VARCHAR(50) NOT NULL,
    is_read          TINYINT(1) NOT NULL DEFAULT 0,
    link             VARCHAR(255) NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

For the contact messages in landing page
# CREATE TABLE contact_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject_category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE SET NULL
);


# RESOLVED OWASP ZAP:
- Absence Anti-CSRF tokens - Jhy
- CROSS-DOMAIN JS SOURCE FILE INCLUSION - Myn
- Server Leaks Information via "X-Powered-By - Myn
- Cookie without Same Site Attribute - Myn
- Missing Anti-clickjacking Header -Myn
- Content Security Policy (CSP) Header Not Set - Irene
- CSP: Wildcard Directive -Myn
- Sub Resource Integrity Attribute Missing -Myn
- CSP:Wildcard Directive - Irene
- CSP: Failure to Define Directive with No Fallback -Myn

# new installed npm 
npm install file-type

.VENV
python -m pip install wordninja
python -m pip install symspellpy

# test the matchmaking for etagalog input 
(venv) PS C:\Users\Mariel Hernandez\PAWSsion-Pet-Adoption-and-Welfare-System\flask-api> python -m pip install taglid

# NEW TABLE FOR INKIND DONATION
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 14, 2026 at 09:34 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pawpon_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `inkind_donations`
--

CREATE TABLE `inkind_donations` (
  `inkind_donation_id` int(11) NOT NULL,
  `adopter_id` int(11) DEFAULT NULL,
  `organization_id` int(11) NOT NULL,
  `donor_name` varchar(255) NOT NULL,
  `donor_email` varchar(255) NOT NULL,
  `category` varchar(50) NOT NULL DEFAULT 'Other',
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit` varchar(50) DEFAULT 'pcs',
  `location_image_path` varchar(255) DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  `rejection_reason` text DEFAULT NULL,
  `proof_image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inkind_donations`
--

INSERT INTO `inkind_donations` (`inkind_donation_id`, `adopter_id`, `organization_id`, `donor_name`, `donor_email`, `category`, `item_name`, `quantity`, `unit`, `location_image_path`, `status`, `rejection_reason`, `proof_image_path`, `created_at`) VALUES
(9, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'dry food', 5, 'pcs', NULL, 'Rejected', 'Verification failed. The donated items are damaged or unusable upon physical inspection.', NULL, '2026-09-05 01:26:17'),
(10, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'kjljli', 6, 'pcs', NULL, 'Rejected', 'Verification failed. The donated items are damaged or unusable upon physical inspection.', NULL, '2026-09-06 01:41:57'),
(11, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'dry good', 5, 'pcs', NULL, 'Pending', NULL, NULL, '2026-09-06 02:00:39'),
(12, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'dry food', 6, 'pcs', NULL, 'Pending', NULL, NULL, '2026-09-06 02:11:35'),
(13, 9, 1, 'Maria Wilkins', 'mariel005hernandez@gmail.com', 'Other', 'Dog food', 6, 'kg', NULL, 'Approved', NULL, NULL, '2026-10-01 08:08:29'),
(14, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'Dog Food', 5, 'packs', NULL, 'Approved', NULL, '/uploads/inkind-proof/inkind-2-1791962671912-444332216.jpg', '2026-10-14 06:41:24'),
(15, 1, 2, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'Deworming tablets', 13, 'pcs', NULL, 'Pending', NULL, NULL, '2026-10-14 06:44:18'),
(16, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Other', 'Rubber toy', 5, 'packs', NULL, 'Approved', NULL, '/uploads/inkind-proof/inkind-2-1791962222770-497990109.jpg', '2026-10-14 06:45:10'),
(17, 1, 1, 'Shinrei Nouzen', 'shin@gmail.com', 'Food & Treats', 'Cat food', 5, 'cans', NULL, 'Approved', NULL, '/uploads/inkind-proof/inkind-2-1791963095557-848113478.jpg', '2026-10-14 07:31:04');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `inkind_donations`
--
ALTER TABLE `inkind_donations`
  ADD PRIMARY KEY (`inkind_donation_id`),
  ADD KEY `adopter_id` (`adopter_id`),
  ADD KEY `organization_id` (`organization_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `inkind_donations`
--
ALTER TABLE `inkind_donations`
  MODIFY `inkind_donation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;



/// kamustahan_updates new table 10/23/2026
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 22, 2026 at 09:49 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pawpon_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `kamustahan_updates`
--

CREATE TABLE `kamustahan_updates` (
  `update_id` int(11) NOT NULL,
  `animal_id` int(11) NOT NULL,
  `adopter_id` int(11) NOT NULL,
  `organization_id` int(11) NOT NULL,
  `update_date` date NOT NULL,
  `update_text` text NOT NULL,
  `photos` text NOT NULL,
  `is_archived` tinyint(1) DEFAULT 0,
  `status` varchar(50) DEFAULT 'Pending',
  `consultation_type` varchar(50) DEFAULT 'Routine Check-up',
  `health_condition` varchar(50) DEFAULT NULL,
  `pet_weight` decimal(5,2) DEFAULT NULL,
  `appetite` varchar(50) DEFAULT NULL,
  `behavior_notes` text DEFAULT NULL,
  `vet_visit_date` date DEFAULT NULL,
  `vet_name` varchar(150) DEFAULT NULL,
  `org_reply` text DEFAULT NULL,
  `org_reply_date` datetime DEFAULT NULL,
  `next_schedule_date` date DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `checklist_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`checklist_data`)),
  `checklist_notes` text DEFAULT NULL,
  `vet_diagnosis` text DEFAULT NULL,
  `weight_kg` decimal(5,2) DEFAULT NULL,
  `risk_level` enum('low','medium','high') DEFAULT 'low',
  `consultation_status` enum('open','awaiting_org','resolved') DEFAULT 'awaiting_org',
  `org_response` text DEFAULT NULL,
  `org_responded_at` datetime DEFAULT NULL,
  `org_responded_by` int(11) DEFAULT NULL,
  `health_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`health_checklist`)),
  `behavior_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`behavior_checklist`)),
  `concerns` text DEFAULT NULL,
  `vet_visit` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `kamustahan_updates`
--

INSERT INTO `kamustahan_updates` (`update_id`, `animal_id`, `adopter_id`, `organization_id`, `update_date`, `update_text`, `photos`, `is_archived`, `status`, `consultation_type`, `health_condition`, `pet_weight`, `appetite`, `behavior_notes`, `vet_visit_date`, `vet_name`, `org_reply`, `org_reply_date`, `next_schedule_date`, `scheduled_date`, `created_at`, `checklist_data`, `checklist_notes`, `vet_diagnosis`, `weight_kg`, `risk_level`, `consultation_status`, `org_response`, `org_responded_at`, `org_responded_by`, `health_checklist`, `behavior_checklist`, `concerns`, `vet_visit`) VALUES
(35, 91, 1, 2, '2026-10-22', 'None', '/uploads/kamustahan/kamustahan-1792607132782.png', 0, 'For Update', 'Routine Check-up', NULL, NULL, NULL, NULL, '2026-10-22', NULL, NULL, NULL, NULL, '2026-10-23', '2026-10-21 18:25:32', NULL, NULL, 'None', NULL, 'medium', 'awaiting_org', NULL, NULL, NULL, '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"diarrhea\",\"activity\":\"playful\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\"}', 'None', 1),
(36, 89, 1, 2, '2026-10-22', 'jnskdw', '/uploads/kamustahan/kamustahan-1792647499561.jpg', 1, 'Archived', 'Routine Check-up', 'Excellent', 7.30, 'Normal', 'iygcqihbxkiqhbdkuxhqbukdhbq3u3dh', '2026-10-09', 'hbjhbcejq', 'greet to know', '2026-10-20 01:28:13', '2026-10-21', '2026-10-23', '2026-10-22 05:38:19', NULL, NULL, 'None', NULL, 'low', 'resolved', 'janzaqsnjqjaja', '2026-10-22 13:39:49', NULL, '{\"appetite\":\"reduced\",\"water\":\"normal\",\"litter\":\"normal\",\"activity\":\"playful\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\"}', 'jnskdw', 1),
(37, 58, 1, 1, '2026-10-10', 'nrdyh5eh5vy', '/uploads/kamustahan/kamustahan-1791618372225.jpg', 1, 'Archived', 'Routine Check-up', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-10', '2026-10-10 07:46:12', NULL, NULL, NULL, NULL, 'low', 'awaiting_org', NULL, NULL, NULL, NULL, NULL, NULL, 0),
(39, 89, 1, 2, '2026-10-22', 'Updated via Health & Behavior Checklist.', '/uploads/kamustahan/kamustahan-1792647654094.png', 0, 'Pending', 'Routine Check-up', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-12-22', '2026-10-22 05:40:54', NULL, NULL, NULL, NULL, 'high', 'resolved', 'okay', '2026-10-22 13:41:22', NULL, '{\"appetite\":\"refusing\",\"water\":\"reduced\",\"litter\":\"diarrhea\",\"activity\":\"playful\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\"}', NULL, 0),
(40, 27, 9, 1, '0000-00-00', '', '', 0, 'For Update', 'Routine Check-up', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-22 07:15:40', NULL, NULL, NULL, NULL, 'low', 'awaiting_org', NULL, NULL, NULL, NULL, NULL, NULL, 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  ADD PRIMARY KEY (`update_id`),
  ADD KEY `animal_id` (`animal_id`),
  ADD KEY `adopter_id` (`adopter_id`),
  ADD KEY `organization_id` (`organization_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  MODIFY `update_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  ADD CONSTRAINT `kamustahan_updates_ibfk_1` FOREIGN KEY (`animal_id`) REFERENCES `animals` (`animal_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kamustahan_updates_ibfk_2` FOREIGN KEY (`adopter_id`) REFERENCES `adopters` (`adopter_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kamustahan_updates_ibfk_3` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`organization_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;



// pet_returns Table 

-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 22, 2026 at 06:27 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pawpon_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `pet_returns`
--

CREATE TABLE `pet_returns` (
  `id` int(11) NOT NULL,
  `animal_id` int(11) NOT NULL,
  `adopter_id` int(11) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `details` text NOT NULL,
  `status` enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `org_response` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `pet_returns`
--
ALTER TABLE `pet_returns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `animal_id` (`animal_id`),
  ADD KEY `adopter_id` (`adopter_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `pet_returns`
--
ALTER TABLE `pet_returns`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `pet_returns`
--
ALTER TABLE `pet_returns`
  ADD CONSTRAINT `pet_returns_ibfk_1` FOREIGN KEY (`animal_id`) REFERENCES `animals` (`animal_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pet_returns_ibfk_2` FOREIGN KEY (`adopter_id`) REFERENCES `adopters` (`adopter_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


// kamustahan update 10/26/26 
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 26, 2026 at 08:01 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pawpon_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `kamustahan_updates`
--

CREATE TABLE `kamustahan_updates` (
  `update_id` int(11) NOT NULL,
  `animal_id` int(11) NOT NULL,
  `adopter_id` int(11) NOT NULL,
  `organization_id` int(11) NOT NULL,
  `update_date` date NOT NULL,
  `update_text` text NOT NULL,
  `photos` text NOT NULL,
  `is_archived` tinyint(1) DEFAULT 0,
  `status` varchar(50) DEFAULT 'Pending',
  `consultation_type` varchar(50) DEFAULT 'Routine Check-up',
  `vet_visit_date` date DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `vet_diagnosis` text DEFAULT NULL,
  `consultation_status` enum('open','awaiting_org','resolved') DEFAULT 'awaiting_org',
  `org_response` text DEFAULT NULL,
  `org_responded_at` datetime DEFAULT NULL,
  `health_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`health_checklist`)),
  `behavior_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`behavior_checklist`)),
  `concerns` text DEFAULT NULL,
  `vet_visit` tinyint(1) DEFAULT 0,
  `org_evaluation_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`org_evaluation_checklist`)),
  `org_verdict` enum('approved','follow_up','urgent') DEFAULT NULL,
  `follow_up_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `kamustahan_updates`
--

INSERT INTO `kamustahan_updates` (`update_id`, `animal_id`, `adopter_id`, `organization_id`, `update_date`, `update_text`, `photos`, `is_archived`, `status`, `consultation_type`, `vet_visit_date`, `scheduled_date`, `created_at`, `vet_diagnosis`, `consultation_status`, `org_response`, `org_responded_at`, `health_checklist`, `behavior_checklist`, `concerns`, `vet_visit`, `org_evaluation_checklist`, `org_verdict`, `follow_up_date`) VALUES
(55, 57, 1, 1, '2026-10-26', 'jxnjanxja', '[\"/uploads/kamustahan/kamustahan-1792993865199.jpg\"]', 1, 'Archived', 'Routine Check-up', '2026-10-26', '2026-10-26', '2026-10-26 05:51:05', 'None', 'resolved', 'follow up', '2026-10-26 13:52:22', '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"normal\",\"vomiting\":\"none\",\"activity\":\"playful\",\"respiratory\":\"normal\",\"grooming\":\"good\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\",\"destructive\":\"none\",\"vocalization\":\"normal\",\"sleep\":\"normal\"}', 'jxnjanxja', 1, '{\"photo_quality\":\"satisfied\",\"health_info\":\"satisfied\",\"behavior_info\":\"satisfied\",\"overall_wellbeing\":\"follow_up\"}', 'follow_up', '2026-10-27'),
(56, 27, 9, 1, '0000-00-00', '', '', 0, 'For Update', 'Routine Check-up', NULL, '2026-10-26', '2026-10-26 05:32:39', NULL, 'awaiting_org', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL),
(57, 32, 1, 1, '2026-10-26', 'Updated via Health & Behavior Checklist.', '[\"/uploads/kamustahan/kamustahan-1792994194982.jpg\"]', 1, 'Archived', 'Routine Check-up', NULL, '2026-10-27', '2026-10-26 05:56:35', NULL, 'resolved', 'oki', '2026-10-26 13:57:09', '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"normal\",\"vomiting\":\"none\",\"activity\":\"playful\",\"respiratory\":\"normal\",\"grooming\":\"good\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"destructive\":\"none\",\"anxiety\":\"none\",\"vocalization\":\"normal\",\"sleep\":\"normal\"}', NULL, 0, '{\"photo_quality\":\"satisfied\",\"health_info\":\"satisfied\",\"behavior_info\":\"satisfied\",\"overall_wellbeing\":\"satisfied\"}', 'approved', NULL),
(58, 57, 1, 1, '2026-10-26', 'Updated via Health & Behavior Checklist.', '[\"/uploads/kamustahan/kamustahan-1792994115263.jpg\"]', 1, 'Archived', 'Routine Check-up', NULL, '2026-10-27', '2026-10-26 05:55:15', NULL, 'resolved', 'oki na', '2026-10-26 13:55:41', '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"normal\",\"vomiting\":\"none\",\"activity\":\"playful\",\"respiratory\":\"normal\",\"grooming\":\"good\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"destructive\":\"none\",\"anxiety\":\"none\",\"vocalization\":\"normal\",\"sleep\":\"normal\"}', NULL, 0, '{\"photo_quality\":\"satisfied\",\"health_info\":\"satisfied\",\"behavior_info\":\"satisfied\",\"overall_wellbeing\":\"satisfied\"}', 'approved', NULL),
(59, 57, 1, 1, '2026-10-26', 'Updated via Health & Behavior Checklist.', '[\"/uploads/kamustahan/kamustahan-1792995753813.jpg\"]', 1, 'Archived', 'Routine Check-up', NULL, '2026-10-27', '2026-10-26 06:22:33', NULL, 'resolved', 'oki', '2026-10-26 14:23:12', '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"normal\",\"vomiting\":\"none\",\"activity\":\"playful\",\"respiratory\":\"normal\",\"grooming\":\"good\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\",\"destructive\":\"none\",\"vocalization\":\"normal\",\"sleep\":\"normal\"}', NULL, 0, '{\"photo_quality\":\"satisfied\",\"health_info\":\"satisfied\",\"behavior_info\":\"satisfied\",\"overall_wellbeing\":\"satisfied\"}', 'approved', NULL),
(60, 57, 1, 1, '2026-10-26', 'none', '[\"/uploads/kamustahan/kamustahan-1792997747010.png\"]', 0, 'Pending', 'Routine Check-up', '2026-10-20', '2026-10-27', '2026-10-26 06:55:47', 'None', 'resolved', 'none', '2026-10-26 14:56:48', '{\"appetite\":\"normal\",\"water\":\"normal\",\"litter\":\"normal\",\"vomiting\":\"none\",\"activity\":\"playful\",\"respiratory\":\"normal\",\"grooming\":\"good\"}', '{\"socialization\":\"friendly\",\"hiding\":\"rarely\",\"anxiety\":\"none\",\"destructive\":\"none\",\"vocalization\":\"normal\",\"sleep\":\"normal\"}', 'none', 1, '{\"photo_quality\":\"satisfied\",\"health_info\":\"satisfied\",\"behavior_info\":\"satisfied\",\"overall_wellbeing\":\"follow_up\"}', 'follow_up', '2026-10-28'),
(61, 57, 1, 1, '0000-00-00', '', '', 0, 'For Update', 'Routine Check-up', NULL, '2026-10-28', '2026-10-26 06:56:48', NULL, 'awaiting_org', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  ADD PRIMARY KEY (`update_id`),
  ADD KEY `animal_id` (`animal_id`),
  ADD KEY `adopter_id` (`adopter_id`),
  ADD KEY `organization_id` (`organization_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  MODIFY `update_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `kamustahan_updates`
--
ALTER TABLE `kamustahan_updates`
  ADD CONSTRAINT `kamustahan_updates_ibfk_1` FOREIGN KEY (`animal_id`) REFERENCES `animals` (`animal_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kamustahan_updates_ibfk_2` FOREIGN KEY (`adopter_id`) REFERENCES `adopters` (`adopter_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kamustahan_updates_ibfk_3` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`organization_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
