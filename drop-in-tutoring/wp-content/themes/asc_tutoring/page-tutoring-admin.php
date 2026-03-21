<?php
/*
Template Name: Tutoring Admin
*/
get_header();
?>

<main id="main" class="container">
  <?php get_template_part('sidebar', 'tutoring'); ?>

  <div class="main-content">
    <article id="post-tutoring-admin" class="page type-page status-publish hentry">
	<a class="button button-secondary admin-nav-button" href="<?php echo esc_url( get_permalink( get_page_by_path('drop-in-tutoring') ) ); ?>">
    Drop-In Tutoring Page
</a>
      <header class="entry-header">
        <h1 class="entry-title">Tutoring Admin</h1>
      </header>

      <div class="entry-content">

        <h2>Admin Controls</h2>

        <?php if (current_user_can('manage_options')) : ?>
          <section class="admin-panel">
            <ul>
              <li><a class="button button-primary" href="#">Add course block</a></li>
              <li><a class="button button-primary" href="#">Edit tutor availability</a></li>
              <li><a class="button button-primary" href="#">Post announcement</a></li>
            </ul>
          </section>
		  
        <?php else : ?>
          <section class="admin-panel">
            <p>You must be logged in with an authorized account to access tutoring admin controls.</p>
          </section>
        <?php endif; ?>
      </div>
    </article>
  </div>
</main>

<?php get_footer(); ?>
